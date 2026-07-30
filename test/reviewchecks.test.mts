/**
 * REVIEW CHECKS — the questions under a bridge have to be about THAT bridge.
 *
 * The scaffold this replaces printed three identical sentences under every card, so a team
 * working a tray of eight read the same checklist eight times and stopped reading it by the
 * third. These tests pin the two properties that make the replacement worth having: the
 * questions actually differ with the link's structure, and they are computed — same bridge in,
 * same questions out, every time, with no model and no randomness anywhere in the path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillCheck, reviewChecksFor } from "../src/lib/reviewChecks.ts";
import { RELATION_TYPES, type Bridge, type Fragment } from "../src/lib/types.ts";

/**
 * The real EN/KO strings, read out of the source.
 *
 * `dict` is deliberately not exported — it is an implementation detail of the provider, and
 * widening its visibility just so a test can see it would be the test dictating production
 * shape. i18n.tsx is also a "use client" React module, so importing it here would drag the
 * provider into a plain node run. Parsing the literal keeps both sides honest: this asserts on
 * the exact bytes that ship, and it fails loudly if the dict's shape ever changes.
 */
const dict: Record<string, { en: string; ko: string }> = (() => {
  const src = readFileSync(new URL("../src/lib/i18n.tsx", import.meta.url), "utf8");
  const open = src.indexOf("const dict = {");
  const close = src.indexOf("} as const;", open);
  assert.ok(open >= 0 && close > open, "could not locate the dict literal in i18n.tsx");
  return eval(`(${src.slice(open + "const dict = ".length, close + 1)})`);
})();

const F = (id: string, seat: string, title = id): Fragment =>
  ({ id, title, body: id, authorName: seat, authorRole: seat, x: 0, y: 0 });
const anon = (id: string, title = id): Fragment =>
  ({ id, title, body: id, authorName: "", authorRole: "", x: 0, y: 0 });

const B = (over: Partial<Bridge> = {}): Bridge => ({
  id: "b1",
  fragmentAId: "a",
  fragmentBId: "b",
  relationType: "overlap",
  explanation: "",
  evidenceA: "queue backs up",
  evidenceB: "refunds are unclear",
  status: "proposed",
  createdBy: "ai",
  ...over,
});

const a = F("a", "rae", "queue backs up at 4pm");
const b = F("b", "tae", "refund policy is unclear");
/**
 * Shorthand for the common "two real cards" case.
 *
 * Deliberately takes NO optional fragment parameters. It used to default them to `a`/`b`, which
 * meant `keys(bridge, a, undefined)` silently substituted `b` for the missing endpoint — the
 * default fires on an explicit `undefined` — so a test that meant to exercise the missing-card
 * path was quietly testing the ordinary one. Any case involving an absent endpoint calls
 * `reviewChecksFor` directly, where what is passed is what arrives.
 */
const keys = (bridge: Bridge, x: Fragment = a, y: Fragment = b) =>
  reviewChecksFor(bridge, x, y).map((c) => c.key);

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\nreview checks");

// THE BUG THIS EXISTS FOR: five relation types used to produce one identical list.
check("each relation type gets its own distinctive question", () => {
  const seen = new Set<string>();
  for (const relationType of RELATION_TYPES) {
    const ks = keys(B({ relationType }));
    const rel = ks.filter((k) => k.startsWith("review.rel."));
    assert.equal(rel.length, 1, `${relationType} carries exactly one relation question`);
    assert.equal(rel[0], `review.rel.${relationType}`);
    seen.add(rel[0]);
  }
  assert.equal(seen.size, RELATION_TYPES.length, "no two types share a question");
});

check("dependency names both pieces, because direction is the thing that's wrong", () => {
  const [dep] = reviewChecksFor(B({ relationType: "dependency" }), a, b).filter((c) =>
    c.key === "review.rel.dependency"
  );
  assert.deepEqual(dep.vars, { a: "queue backs up at 4pm", b: "refund policy is unclear" });
});

check("a long title is clipped so an 11px list item doesn't reflow the card", () => {
  const long = F("a", "rae", "the escalation path assumes one channel and one shift lead");
  const [dep] = reviewChecksFor(B({ relationType: "dependency" }), long, b).filter((c) =>
    c.key === "review.rel.dependency"
  );
  assert.ok(dep.vars!.a.length <= 28, `clipped to ${dep.vars!.a.length}`);
  assert.ok(dep.vars!.a.endsWith("…"), "clipping is visible rather than silent truncation");
});

// Asking "do the quoted parts support this?" with nothing quoted is the original bug in
// miniature — a question about something that isn't on the screen.
check("both quotes present → the quoted-parts question", () => {
  assert.ok(keys(B()).includes("review.ev.both"));
});

check("no quotes → the no-anchor question, and NEVER the quoted-parts one", () => {
  const ks = keys(B({ evidenceA: "", evidenceB: "" }));
  assert.ok(ks.includes("review.ev.none"));
  assert.ok(!ks.includes("review.ev.both"));
  assert.ok(!ks.includes("review.ev.one"));
});

check("one quote → the one-sided question, naming the UNQUOTED card", () => {
  const missingB = reviewChecksFor(B({ evidenceB: "  " }), a, b).find((c) => c.key === "review.ev.one");
  assert.deepEqual(missingB!.vars, { piece: "refund policy is unclear" });
  const missingA = reviewChecksFor(B({ evidenceA: "" }), a, b).find((c) => c.key === "review.ev.one");
  assert.deepEqual(missingA!.vars, { piece: "queue backs up at 4pm" });
  assert.ok(!keys(B({ evidenceB: "" })).includes("review.ev.both"));
});

check("whitespace-only evidence counts as absent, not as a quote", () => {
  assert.ok(keys(B({ evidenceA: "   ", evidenceB: "\n" })).includes("review.ev.none"));
});

// `tension` throughout: it is non-confoundable, so the third slot is the seat check
// unconditionally and these assertions isolate seat wording from the rotation.
check("cross-seat and same-seat get different questions", () => {
  const T = B({ relationType: "tension" });
  const cross = reviewChecksFor(T, a, b).find((c) => c.key === "review.seat.cross");
  assert.deepEqual(cross!.vars, { seatA: "rae", seatB: "tae" });

  const own = reviewChecksFor(T, F("a", "rae", "one"), F("b", "rae", "two")).find((c) =>
    c.key === "review.seat.same"
  );
  assert.deepEqual(own!.vars, { seat: "rae" });
});

check("unknown authorship asks nothing about seats — blank means unknown, not one person", () => {
  const T = B({ relationType: "tension" });
  const ks = keys(T, anon("a"), anon("b"));
  assert.ok(!ks.some((k) => k.startsWith("review.seat.")), ks.join(", "));
  // one named end is still not enough to say whose reading this is
  assert.ok(!keys(T, a, anon("b")).some((k) => k.startsWith("review.seat.")));
});

// A tray bridge whose fragment was removed reaches the card with an endpoint undefined —
// `byId` in ConnectScreen is a `.find()`. The header can print "?" and stay readable; a
// QUESTION cannot, so nothing may quote a card that is not on the screen.
check("a missing endpoint never invents a seat and never quotes a card that isn't there", () => {
  // called directly, never through `keys`, so what is passed is what arrives
  for (const relationType of RELATION_TYPES) {
    for (const [x, y] of [[a, undefined], [undefined, b], [undefined, undefined]] as const) {
      const out = reviewChecksFor(B({ relationType }), x, y);
      assert.ok(out.length >= 2 && out.length <= 3, `got ${out.length}`);
      assert.ok(!out.some((c) => c.key.startsWith("review.seat.")), "no seat named out of nothing");
      assert.ok(!out.some((c) => c.key === "review.alt.confound"), "confounder steps aside");
    }
  }
});

/**
 * THE RENDERED STRING, in both languages — the assertion that would have caught this class of
 * bug the first time.
 *
 * Every other test here inspects `vars`, and that is precisely how a placeholder reached the
 * screen once already: the vars looked structurally fine (`{a: "queue backs up", b: "?"}`) while
 * the sentence they produced quoted a card that does not exist. Korean was worse, since a
 * particle attaches to the placeholder (`"?"와`). So this walks the REAL dictionary and asserts
 * on the final text a person would read.
 */
check("no rendered check ever shows a bare ? or an unsubstituted placeholder", () => {
  const missing: Array<[Fragment | undefined, Fragment | undefined]> = [
    [a, undefined],
    [undefined, b],
    [undefined, undefined],
    [F("a", "rae", "   "), b], // present object, blank title — same hazard, different route
  ];
  for (const relationType of RELATION_TYPES) {
    for (const [x, y] of [...missing, [a, b] as const]) {
      for (const id of ["b1", "b2", "b3", "b4"]) {
        for (const lang of ["en", "ko"] as const) {
          for (const c of reviewChecksFor(B({ id, relationType }), x, y)) {
            const text = fillCheck(dict[c.key][lang], c.vars);
            // a trailing "?" is what these sentences ARE; what must never appear is a "?" sitting
            // where a card title belongs — i.e. one that is quoted, or has a particle attached
            assert.ok(
              !/[“"']\s*\?\s*[”"']/.test(text),
              `${c.key}/${lang} quoted a missing card: ${text}`
            );
            assert.ok(!/\{\w+\}/.test(text), `${c.key}/${lang} left a placeholder: ${text}`);
            assert.ok(!text.includes("undefined"), `${c.key}/${lang} leaked undefined: ${text}`);
          }
        }
      }
    }
  }
});

check("dependency falls back to the abstract direction question when a card is missing", () => {
  // weaker than naming both ends, but still answerable — and it is the degraded path
  const ks = reviewChecksFor(B({ relationType: "dependency" }), undefined, b).map((c) => c.key);
  assert.ok(ks.includes("review.rel.dependencyAbstract"));
  assert.ok(!ks.includes("review.rel.dependency"));
  // and the concrete one is still what ships when both cards are present
  assert.ok(keys(B({ relationType: "dependency" })).includes("review.rel.dependency"));
});

// THE CONFOUNDER — the one question in the pool that points at a piece nobody has tabled yet.
// It is the only check that asks about a GAP rather than validating a link the AI already drew,
// which is the job this project's invariant reserves for the AI, so its reach is pinned here.
check("the confounder appears for dependency and overlap", () => {
  // dependency replaces the seat check outright, so one id is enough to see it
  assert.ok(keys(B({ relationType: "dependency" })).includes("review.alt.confound"));
  // overlap rotates it against the seat check, so it must show up across a spread of ids
  const overlapIds = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
  const withConfound = overlapIds.filter((id) =>
    keys(B({ id, relationType: "overlap" })).includes("review.alt.confound")
  );
  assert.ok(withConfound.length > 0, "some overlap cards ask it");
  assert.ok(withConfound.length < overlapIds.length, "and some ask the seat question instead");
});

check("the confounder never appears for tension, complement or separate", () => {
  for (const relationType of ["tension", "complement", "separate"] as const) {
    for (const id of ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"]) {
      assert.ok(
        !keys(B({ id, relationType })).includes("review.alt.confound"),
        `${relationType}/${id} must not ask about a third cause`
      );
    }
  }
});

check("the confounder names both cards concretely rather than saying “both cards”", () => {
  const c = reviewChecksFor(B({ relationType: "dependency" }), a, b).find(
    (x) => x.key === "review.alt.confound"
  );
  assert.deepEqual(c!.vars, { a: "queue backs up at 4pm", b: "refund policy is unclear" });
});

check("on dependency the confounder replaces the seat check, never joins it", () => {
  for (const id of ["b1", "b2", "b3", "b4", "b5", "b6"]) {
    const ks = keys(B({ id, relationType: "dependency" }));
    assert.ok(ks.includes("review.alt.confound"));
    assert.ok(!ks.some((k) => k.startsWith("review.seat.")), `${id} kept a seat check too`);
    assert.equal(ks.length, 3);
  }
});

// The two id-derived decisions must not collapse onto one bit: if they did, every overlap card
// showing the confounder would also open with the same check, restoring the uniformity this
// module exists to remove — inside the overlap group instead of across the whole tray.
check("third-slot choice and lead order vary independently", () => {
  const seen = new Set(
    ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10"].map((id) => {
      const ks = keys(B({ id, relationType: "overlap" }));
      return `${ks[0]}|${ks[2]}`;
    })
  );
  assert.ok(seen.size > 2, `expected more than two shapes, saw ${[...seen].join("  /  ")}`);
});

check("count stays within 2..3 across every combination of the signals", () => {
  const ends: Array<[Fragment | undefined, Fragment | undefined]> = [
    [a, b],
    [F("a", "rae"), F("b", "rae")],
    [anon("a"), anon("b")],
    [a, undefined],
    [undefined, undefined],
  ];
  for (const relationType of RELATION_TYPES) {
    for (const [evidenceA, evidenceB] of [["x", "y"], ["x", ""], ["", "y"], ["", ""]]) {
      for (const [x, y] of ends) {
        // ids sweep both settings of every id-derived bit
        for (const id of ["b1", "b2", "b3", "b4", "b5", "b6"]) {
          const out = reviewChecksFor(B({ id, relationType, evidenceA, evidenceB }), x, y);
          assert.ok(out.length >= 2 && out.length <= 3, `got ${out.length}`);
          assert.equal(new Set(out.map((c) => c.key)).size, out.length, "no repeated question");
          assert.equal(out.filter((c) => c.key.startsWith("review.rel.")).length, 1);
          assert.equal(out.filter((c) => c.key.startsWith("review.ev.")).length, 1);
          // the third slot holds ONE of seat/confounder — restoring the confounder must not
          // quietly push any card to four
          const third = out.filter(
            (c) => c.key.startsWith("review.seat.") || c.key === "review.alt.confound"
          );
          assert.ok(third.length <= 1, `two third-slot checks on ${relationType}/${id}`);
        }
      }
    }
  }
});

// Order rotation is what stops two consecutive cards in a tray from opening identically. It has
// to come from the id: `Math.random()` would reshuffle the questions under a team mid-argument
// and would break sample mode's reproducibility (and this repo already ate one unstable-id bug).
check("the leading question rotates across bridges, deterministically by id", () => {
  const leads = new Set(
    ["b1", "b2", "b3", "b4", "b5", "b6"].map((id) => keys(B({ id }))[0])
  );
  assert.ok(leads.size > 1, "consecutive cards do not all open with the same sentence");
});

check("same input twice → identical output, and no dependence on call order", () => {
  // includes the two types whose third slot is id-derived, so the confounder path is pinned too
  for (const relationType of RELATION_TYPES) {
    const bridge = B({ id: "bridge_x7", relationType, evidenceB: "" });
    const first = reviewChecksFor(bridge, a, b);
    reviewChecksFor(B({ id: "other", relationType: "overlap" }), b, a); // interleave another call
    const second = reviewChecksFor(bridge, a, b);
    assert.deepEqual(second, first);
    for (let i = 0; i < 20; i++) assert.deepEqual(reviewChecksFor(bridge, a, b), first);
  }
});

check("fillCheck substitutes with the repo's existing {x} convention", () => {
  assert.equal(fillCheck("does {a} precede {b}?", { a: "one", b: "two" }), "does one precede two?");
  assert.equal(fillCheck("no vars here"), "no vars here");
  // a value containing a brace must not be re-scanned as another placeholder
  assert.equal(fillCheck("{a}", { a: "{b}", b: "no" }), "{b}");
});

console.log(`\n  ${n} checks passed\n`);
