import type { Bridge, BridgeEdit, Fragment, RelationType } from "./types";

/**
 * GROUNDING — the layer that makes the LLM's output *checkable* against the team's own table.
 *
 * The problem this solves. Every prompt in this app already forbids the model from authoring
 * perspective content, but "forbid" is a request: nothing in the code could tell whether a
 * reading the model handed back was actually read off the team's pieces or free-associated
 * around them. The prompt asked nicely; the server took whatever came back on faith.
 *
 * The fix is to make citation *mechanical* rather than rhetorical:
 *
 *   1. Every piece and every confirmed link gets a short, stable HANDLE — F1, F2, B1, B2 …
 *      — minted here, listed in the prompt, and the ONLY way the model is allowed to point at
 *      something.
 *   2. The model must return, beside each claim, the handles it rests on (`grounds`).
 *   3. This module verifies those handles against the real table. A handle that does not
 *      exist is dropped. A claim left with no surviving handle is marked ungrounded.
 *
 * What that buys, concretely:
 *   - Hallucinated citations cannot reach the UI — they are removed by code, not by prompt.
 *   - "Is the AI reading THEIR table?" becomes a measurable rate (see `groundingRate`)
 *     instead of an assurance, which is what makes it reportable as a result.
 *   - The handles survive into the event log, so a later analysis can ask which pieces and
 *     which links the AI's framing actually leaned on — and whether the team kept it.
 *
 * Design constraint held throughout: grounding NEVER rewrites the model's prose. It only ever
 * removes citations and reports what is left. A degraded (unverifiable) answer still renders
 * exactly as it does today, so nothing in the UI depends on this succeeding.
 */

/** Prefix marking a handle as pointing at a piece (fragment) vs a link (bridge). */
const FRAGMENT_PREFIX = "F";
const BRIDGE_PREFIX = "B";

/** A piece on the table, tagged with the handle the model must cite it by. */
export interface HandledFragment {
  handle: string; // "F1"
  id: string; // the real fragment id
  title: string;
  body: string;
  authorRole: string;
}

/**
 * A confirmed link, tagged with its handle — and, crucially, with what the AI originally
 * proposed beside what the team finally settled on.
 *
 * That pair is the most information-dense thing in a session. When a team takes a link the AI
 * called `overlap` ("these are the same thing") and re-types it to `tension` ("no — these
 * genuinely pull against each other"), they have made an explicit boundary-work claim: they
 * refused a merge. Until now that claim was recorded in the event log and then thrown away at
 * prompt time, so the model read the team's graph without ever seeing where the team had
 * overruled it. Carrying `aiRelationType`/`retyped` into the prompt closes that loop.
 */
export interface HandledBridge {
  handle: string; // "B1"
  id: string;
  relationType: RelationType;
  aTitle: string;
  bTitle: string;
  aHandle: string;
  bHandle: string;
  explanation: string;
  evidenceA: string;
  evidenceB: string;
  /** what the AI first called this link, when it differs from the team's final type */
  aiRelationType?: RelationType;
  /** the team re-typed the relation — they refused the AI's reading of the boundary */
  retyped: boolean;
  /** the team rewrote the explanation in their own words */
  rewritten: boolean;
  /** the team drew this link themselves; the AI never proposed it */
  humanDrawn: boolean;
}

/** The whole table, handle-indexed — what prompts render from and what citations resolve against. */
export interface GroundingTable {
  fragments: HandledFragment[];
  bridges: HandledBridge[];
  /** every handle that legitimately exists, for O(1) citation checking */
  valid: Set<string>;
  byHandle: Map<string, HandledFragment | HandledBridge>;
}

/**
 * Mint handles for the pieces and links that are actually in play.
 *
 * Handles are positional (F1, F2, … in the given order) rather than derived from the real ids.
 * Real ids are long, look like nonce strings, and invite the model to pattern-match on them;
 * a short ordinal is easier for the model to copy exactly and — because it is minted per
 * request — cannot be smuggled in from anywhere else. Verification maps back to real ids here.
 */
export function buildGroundingTable(
  fragments: Fragment[],
  bridges: Bridge[],
  history: Map<string, BridgeEdit> = new Map()
): GroundingTable {
  const handled: HandledFragment[] = fragments.map((f, i) => ({
    handle: `${FRAGMENT_PREFIX}${i + 1}`,
    id: f.id,
    title: f.title,
    body: f.body,
    authorRole: f.authorRole,
  }));
  const handleOfFragment = new Map(handled.map((f) => [f.id, f.handle]));
  const titleOfFragment = new Map(handled.map((f) => [f.id, f.title]));

  // Only links whose BOTH ends are on this table can be cited — a link half-outside the
  // cluster would resolve to a dangling handle and is dropped rather than half-rendered.
  const handledBridges: HandledBridge[] = bridges
    .filter((b) => handleOfFragment.has(b.fragmentAId) && handleOfFragment.has(b.fragmentBId))
    .map((b, i) => {
      const h = history.get(b.id);
      const aiType = h?.aiRelationType;
      return {
        handle: `${BRIDGE_PREFIX}${i + 1}`,
        id: b.id,
        relationType: b.relationType,
        aTitle: titleOfFragment.get(b.fragmentAId)!,
        bTitle: titleOfFragment.get(b.fragmentBId)!,
        aHandle: handleOfFragment.get(b.fragmentAId)!,
        bHandle: handleOfFragment.get(b.fragmentBId)!,
        explanation: b.explanation,
        evidenceA: b.evidenceA,
        evidenceB: b.evidenceB,
        aiRelationType: aiType && aiType !== b.relationType ? aiType : undefined,
        // `retyped` is trusted from the log when present, but a stored AI type that differs
        // from the final one is itself proof of a re-type even if the flag went missing.
        retyped: Boolean(h?.retyped || (aiType && aiType !== b.relationType)),
        rewritten: Boolean(h?.edited),
        humanDrawn: b.createdBy === "human",
      };
    });

  const byHandle = new Map<string, HandledFragment | HandledBridge>();
  handled.forEach((f) => byHandle.set(f.handle, f));
  handledBridges.forEach((b) => byHandle.set(b.handle, b));

  return {
    fragments: handled,
    bridges: handledBridges,
    valid: new Set(byHandle.keys()),
    byHandle,
  };
}

/**
 * Render the pieces for a prompt, each led by the handle it must be cited as.
 * Author role is included because "who is speaking" is part of what a piece IS here —
 * the same sentence from an operator and from a customer are different pieces of the elephant.
 */
export function renderFragments(table: GroundingTable): string {
  if (!table.fragments.length) return "(none)";
  return table.fragments
    .map((f) => `[${f.handle}] "${f.title}"${f.authorRole && f.authorRole !== "—" ? ` (from the ${f.authorRole} seat)` : ""} — ${f.body}`)
    .join("\n");
}

/**
 * Render the confirmed links, including the team's own edit history.
 *
 * The annotation lines are the point of this function. A model that can see "the team
 * OVERRODE the AI here: proposed overlap, team re-typed to tension" knows something no
 * amount of re-reading the final graph would tell it — that this particular boundary was
 * contested and the team's call was to keep the two apart. Likewise a hand-drawn link is a
 * connection the team went out of its way to assert; it deserves more weight than one they
 * merely accepted.
 */
export function renderBridges(table: GroundingTable): string {
  if (!table.bridges.length) return "(none)";
  return table.bridges
    .map((b) => {
      const arrow =
        b.relationType === "dependency"
          ? `${b.aHandle} --${b.relationType}--> ${b.bHandle}`
          : b.relationType === "separate"
          ? `${b.aHandle} -/-${b.relationType}-/- ${b.bHandle}`
          : `${b.aHandle} <--${b.relationType}--> ${b.bHandle}`;
      const lines = [`[${b.handle}] ${arrow} : "${b.explanation}"`];
      // `separate` is the one relation that means the OPPOSITE of a connection, and a bare
      // type name reads to a model like just another way of linking two things. Spell the
      // boundary out, because a reading that fuses a pair the team explicitly kept apart is
      // the single worst failure this tool can produce.
      if (b.relationType === "separate") {
        lines.push(
          `      ↳ KEEP APART: the team declared these two must NOT be merged. Never write a reading that treats them as one thing.`
        );
      }
      if (b.retyped && b.aiRelationType) {
        lines.push(
          `      ↳ THE TEAM OVERRODE THE AI: it proposed "${b.aiRelationType}", the team re-typed it to "${b.relationType}". Treat the team's type as final and meaningful — they refused the AI's reading of this boundary.`
        );
      }
      if (b.humanDrawn) {
        lines.push(`      ↳ THE TEAM DREW THIS THEMSELVES — the AI never proposed it.`);
      } else if (b.rewritten) {
        lines.push(`      ↳ the team rewrote this explanation in their own words.`);
      }
      if (b.evidenceA || b.evidenceB) {
        lines.push(`      ↳ evidence: ${b.aHandle} "${b.evidenceA}" · ${b.bHandle} "${b.evidenceB}"`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

/** The instruction block that tells a model how to cite. Kept in one place so every prompt
 *  that asks for `grounds` states the contract identically. */
export const CITATION_RULES = `CITATION — every claim you make must be traceable to the table:
- Cite ONLY the bracketed handles above ([F1], [B2], …). They are the only valid references.
- Put the handles a claim rests on in that claim's "grounds" array, e.g. "grounds":["F2","B1"].
- Cite the pieces/links you ACTUALLY used, not everything available. 1–3 handles is typical.
- NEVER invent a handle. A handle that is not listed above will be discarded, and a claim left
  with no valid handle is treated as unsupported. If you cannot point at the table for a
  claim, make a different claim you CAN point at.`;

/** One claim after verification: the model's prose, plus only the citations that resolve. */
export interface GroundedClaim<T = string> {
  value: T;
  /** handles that were verified to exist on the table */
  grounds: string[];
  /** handles the model cited that do NOT exist — kept for measurement, never shown */
  invalidGrounds: string[];
  /** the model cited nothing that resolves — the claim stands on its own */
  ungrounded: boolean;
}

/** Normalize whatever the model put in a `grounds` field into clean handle strings.
 *  Models drift: "F1", "[F1]", "f1", " F1 " all mean the same thing and all get accepted;
 *  anything else is simply not a handle and falls through to the invalid bucket. */
function normalizeHandles(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    // a model that returns "F1, B2" instead of an array shouldn't lose its citations
    if (typeof raw === "string") return normalizeHandles(raw.split(/[,\s]+/));
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().replace(/^\[|\]$/g, "").toUpperCase();
    if (cleaned) out.push(cleaned);
  }
  return [...new Set(out)];
}

/**
 * Verify one claim's citations against the table.
 *
 * Note what this deliberately does NOT do: it never edits, rejects, or rewrites `value`.
 * A claim whose citations all turn out to be invented still passes through with its prose
 * intact and `ungrounded: true`. The UI is free to render it exactly as before — grounding is
 * an added signal, never a gate that could blank the screen on a model's bad day.
 */
export function verifyClaim<T>(value: T, rawGrounds: unknown, table: GroundingTable): GroundedClaim<T> {
  const cited = normalizeHandles(rawGrounds);
  const grounds: string[] = [];
  const invalidGrounds: string[] = [];
  for (const h of cited) {
    if (table.valid.has(h)) grounds.push(h);
    else invalidGrounds.push(h);
  }
  return { value, grounds, invalidGrounds, ungrounded: grounds.length === 0 };
}

/**
 * How well an answer was anchored in the team's own table — the number this whole module
 * exists to make computable.
 *
 * `rate` is the share of claims carrying at least one verifiable citation, and
 * `fabricationRate` the share of cited handles that pointed at nothing. Reported per response
 * (and logged), these turn "the AI reads the team's structure rather than free-associating"
 * from a design assertion into an observable that can be compared across conditions — with an
 * ungrounded prompt, with the structure withheld, with a different model.
 */
export interface GroundingReport {
  claims: number;
  grounded: number;
  rate: number; // 0..1
  citedHandles: string[];
  invalidHandles: string[];
  fabricationRate: number; // 0..1 of all cited handles
}

export function groundingReport(claims: Array<GroundedClaim<unknown>>): GroundingReport {
  const grounded = claims.filter((c) => !c.ungrounded).length;
  const cited = new Set<string>();
  const invalid: string[] = [];
  let totalCited = 0;
  for (const c of claims) {
    c.grounds.forEach((g) => {
      cited.add(g);
      totalCited++;
    });
    c.invalidGrounds.forEach((g) => {
      invalid.push(g);
      totalCited++;
    });
  }
  return {
    claims: claims.length,
    grounded,
    rate: claims.length ? grounded / claims.length : 0,
    citedHandles: [...cited],
    invalidHandles: [...new Set(invalid)],
    fabricationRate: totalCited ? invalid.length / totalCited : 0,
  };
}

/** Resolve verified handles back to real ids, so the event log records what the AI leaned on
 *  in terms an analysis of the session can join against fragments and bridges. */
export function resolveToIds(grounds: string[], table: GroundingTable): { fragmentIds: string[]; bridgeIds: string[] } {
  const fragmentIds: string[] = [];
  const bridgeIds: string[] = [];
  for (const h of grounds) {
    const hit = table.byHandle.get(h);
    if (!hit) continue;
    if (h.startsWith(FRAGMENT_PREFIX)) fragmentIds.push(hit.id);
    else if (h.startsWith(BRIDGE_PREFIX)) bridgeIds.push(hit.id);
  }
  return { fragmentIds, bridgeIds };
}
