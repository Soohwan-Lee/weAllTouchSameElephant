import type { Bridge, Fragment, RelationType } from "./types";
import type { Cluster } from "./clusters";

/**
 * SYNTHESIS ENGINE — "the elephant, assembled."
 *
 * This replaces the old crux.ts "count the degree, crown one bottleneck" logic.
 * That logic collapsed a rich picture into a single winner, which contradicts the
 * theory this probe is built on:
 *
 *   - Cronin & Weingart 2007 (representational gaps): groups fail not for lack of
 *     information but because complementary partial views are misread as redundant,
 *     irrelevant, or competing. The remedy is to INTEGRATE differences while KEEPING
 *     them — not to flatten them into one answer.
 *   - Kolko 2010 (design synthesis): synthesis = forging connections until a bigger
 *     picture and its meaningful patterns become visible.
 *   - WATSE v5 Puzzle Table (§4.5): people assemble first, AI mirrors after. The payoff
 *     is "your piece and mine are two sides of the same elephant," not a verdict.
 *
 * So instead of one number per node, we compute the SHAPE the pieces make together:
 *   1. FACETS   — pieces that are truly the SAME thing seen differently become one side of
 *                 the elephant. Only "overlap" fuses (transitively). This is deliberate:
 *                 the four relations are NOT interchangeable, and conflating them was a bug.
 *   2. FLOW     — directional relations that shape the spine, NOT the merge:
 *                   • "dependency"  — A causes/blocks/enables B  → facet(A) → facet(B)
 *                   • "complement"  — A supplies context B NEEDS → facet(A) → facet(B)
 *                 "complement" used to fuse (union-find), which over-merged genuinely
 *                 distinct sides and inflated facet size — feeding the very "big cluster =
 *                 important" bias we're trying to kill. A completes B is a DIRECTIONAL bond
 *                 ("B leans on A"), not sameness, so it belongs in the flow, not the merge.
 *   3. TENSIONS — kept alive as their own strand, never merged away. (Cronin: preserve.)
 *   4. KEYSTONE — the causal ROOT: the side that drives others but nothing drives. Chosen by
 *                 position in the flow, not connection count — a sparsely-linked root wins.
 *   5. COVERAGE — how much of the table has joined the one shape, and what floats loose.
 *
 * Why these four and not more/fewer: overlap (identity), tension (conflict), dependency
 * (causal), complement (needs-context) are the minimal set that spans how partial views
 * actually relate — same / against / because-of / incomplete-without. Overlap is the only
 * one that says "these are the same side"; the other three keep the pieces distinct.
 */

export type FacetKind = "core" | "supporting";

/** A "side of the elephant": pieces that are really the same thing seen differently. */
export interface Facet {
  id: string;
  fragmentIds: string[];
  /** the fragment that best anchors this facet (most within-facet links) */
  anchorId: string;
  /** dependency depth: 0 = a root pressure, higher = a downstream consequence */
  depth: number;
  kind: FacetKind;
  /** how many other facets depend ON this one (out-degree — it drives them) */
  supports: number;
  /** how many other facets this one depends ON (in-degree — it's driven by them) */
  dependsOn: number;
  /** true when this side drives others but nothing drives it — a genuine ROOT.
   *  Root-ness is causal position, NOT connection count: a root can have few links. */
  isRoot: boolean;
}

/** A tension that survived assembly — a live disagreement, not a defect. */
export interface LiveTension {
  bridgeId: string;
  facetA: string;
  facetB: string;
  /** true when both ends sit in the SAME facet (an internal, self-contained tension) */
  internal: boolean;
}

/** A directed dependency between two facets (A feeds / drives B). */
export interface FacetFlow {
  from: string; // facet id
  to: string; // facet id
  bridgeIds: string[];
}

export interface Synthesis {
  facets: Facet[];
  tensions: LiveTension[];
  flow: FacetFlow[];
  /** causal chains root→symptom, each a list of facet ids from upstream to downstream.
   *  These are the "spine" the team built — what drives what, read left to right. */
  spine: string[][];
  /** the ROOT the picture rests on: the side that drives others but nothing drives.
   *  Chosen by causal position, not connection count — a sparsely-linked root still wins
   *  over a densely-linked symptom. Null when the flow is flat (no root to point at). */
  keystoneFacetId: string | null;
  maxDepth: number;
  coverage: {
    total: number; // fragments in the cluster
    joined: number; // fragments that share a facet with ≥1 other piece
    facetCount: number;
    tensionCount: number;
    /** 0..1 — how assembled the picture is (facets fused / integration reached) */
    wholeness: number;
  };
  /** fragments in the cluster that never got a confirmed link — still floating */
  looseFragmentIds: string[];
}

/** Only "overlap" fuses two pieces into the SAME side. The others keep them distinct:
 *  complement/dependency become directional flow; tension stays its own strand. */
const isFusing = (r: RelationType) => r === "overlap";
/** Relations that create a directional bond (A → B): dependency (A drives B) and
 *  complement (A supplies context B needs, so B leans on A). */
const isDirectional = (r: RelationType) => r === "dependency" || r === "complement";

/**
 * Fuse fragments into facets using overlap/complement bridges (union-find),
 * then order facets by dependency depth and pick a keystone.
 */
export function computeSynthesis(
  fragments: Fragment[],
  bridges: Bridge[],
  cluster: Cluster
): Synthesis {
  const ids = cluster.fragmentIds;
  const idSet = new Set(ids);
  const clusterBridges = bridges.filter(
    (b) => idSet.has(b.fragmentAId) && idSet.has(b.fragmentBId)
  );

  // 1. FACETS via union-find over fusing bridges (overlap/complement).
  const parent = new Map<string, string>();
  ids.forEach((id) => parent.set(id, id));
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const b of clusterBridges) {
    if (isFusing(b.relationType)) union(b.fragmentAId, b.fragmentBId);
  }

  const facetMembers = new Map<string, string[]>();
  ids.forEach((id) => {
    const root = find(id);
    if (!facetMembers.has(root)) facetMembers.set(root, []);
    facetMembers.get(root)!.push(id);
  });

  // stable facet ids (f0, f1, …), largest facet first so the "main side" is f0
  const roots = [...facetMembers.keys()].sort(
    (a, b) => facetMembers.get(b)!.length - facetMembers.get(a)!.length
  );
  const rootToFacetId = new Map<string, string>();
  roots.forEach((r, i) => rootToFacetId.set(r, `facet_${i}`));
  const facetIdOf = (fragId: string) => rootToFacetId.get(find(fragId))!;

  // within-facet degree → anchor (the piece other pieces in the facet lean on)
  const withinDegree = new Map<string, number>();
  ids.forEach((id) => withinDegree.set(id, 0));
  for (const b of clusterBridges) {
    if (isFusing(b.relationType) && facetIdOf(b.fragmentAId) === facetIdOf(b.fragmentBId)) {
      withinDegree.set(b.fragmentAId, (withinDegree.get(b.fragmentAId) ?? 0) + 1);
      withinDegree.set(b.fragmentBId, (withinDegree.get(b.fragmentBId) ?? 0) + 1);
    }
  }

  // 2. FACET FLOW from directional bridges (A drives B → facet(A) → facet(B)).
  //    Both "dependency" (A causes/blocks B) and "complement" (A supplies context B needs,
  //    so B leans on A) point the same way: A is more upstream, B rests on it.
  //    Track BOTH out-edges (this side drives others) and in-edges (others drive it),
  //    because "what's the root?" is about in-edges, not raw connection count.
  const flowKey = (a: string, b: string) => `${a}->${b}`;
  const flowMap = new Map<string, FacetFlow>();
  const outFacets = new Map<string, Set<string>>();
  const inFacets = new Map<string, Set<string>>();
  roots.forEach((r) => {
    const fid = rootToFacetId.get(r)!;
    outFacets.set(fid, new Set());
    inFacets.set(fid, new Set());
  });
  for (const b of clusterBridges) {
    if (!isDirectional(b.relationType)) continue;
    const fa = facetIdOf(b.fragmentAId);
    const fb = facetIdOf(b.fragmentBId);
    if (fa === fb) continue; // a bond inside one side doesn't shape the between-side flow
    const key = flowKey(fa, fb);
    if (!flowMap.has(key)) flowMap.set(key, { from: fa, to: fb, bridgeIds: [] });
    flowMap.get(key)!.bridgeIds.push(b.id);
    outFacets.get(fa)!.add(fb);
    inFacets.get(fb)!.add(fa);
  }
  const flow = [...flowMap.values()];

  // 3. DEPTH via longest dependency path over the facet DAG (cycle-safe DFS).
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const dfs = (facetId: string): number => {
    if (depthMemo.has(facetId)) return depthMemo.get(facetId)!;
    if (visiting.has(facetId)) return 0; // break cycle
    visiting.add(facetId);
    let d = 0;
    for (const nxt of outFacets.get(facetId) ?? []) d = Math.max(d, 1 + dfs(nxt));
    visiting.delete(facetId);
    depthMemo.set(facetId, d);
    return d;
  };
  const facetIds = roots.map((r) => rootToFacetId.get(r)!);
  facetIds.forEach((fid) => dfs(fid));
  const maxPathDepth = Math.max(0, ...facetIds.map((fid) => depthMemo.get(fid) ?? 0));
  // invert so root pressures (drivers) sit at depth 0, symptoms at higher depth
  const depthOf = (fid: string) => maxPathDepth - (depthMemo.get(fid) ?? 0);

  // supports = how many distinct facets this one drives (out-degree)
  const supportsOf = (fid: string) => outFacets.get(fid)?.size ?? 0;
  // dependsOn = how many distinct facets drive THIS one (in-degree)
  const dependsOnOf = (fid: string) => inFacets.get(fid)?.size ?? 0;
  // a genuine ROOT: it drives something, but nothing drives it. Few links is fine.
  const isRootOf = (fid: string) => supportsOf(fid) > 0 && dependsOnOf(fid) === 0;

  // 4. FACET objects
  const facets: Facet[] = roots.map((root) => {
    const members = facetMembers.get(root)!;
    const fid = rootToFacetId.get(root)!;
    // anchor = highest within-facet degree, tie-break by first
    let anchorId = members[0];
    let best = -1;
    for (const m of members) {
      const d = withinDegree.get(m) ?? 0;
      if (d > best) {
        best = d;
        anchorId = m;
      }
    }
    const supports = supportsOf(fid);
    // "core" = a facet that fuses multiple pieces OR drives others; else supporting.
    const kind: FacetKind = members.length > 1 || supports > 0 ? "core" : "supporting";
    return {
      id: fid,
      fragmentIds: members,
      anchorId,
      depth: depthOf(fid),
      kind,
      supports,
      dependsOn: dependsOnOf(fid),
      isRoot: isRootOf(fid),
    };
  });

  // 5. KEYSTONE — the ROOT of the causal flow, not the most-connected side.
  //    "What's really the core?" is a question about CAUSAL POSITION: the side that
  //    drives others but that nothing drives. A root can have few links and still win
  //    over a densely-connected symptom — that's the whole point (a bottleneck upstream
  //    isn't always the loudest, most-linked node).
  //
  //    Ranking (all among facets that drive at least one other side):
  //      1. genuine roots first (nothing drives them)
  //      2. among those, the one that reaches the MOST of the picture downstream
  //         (net leverage = supports − dependsOn), so a true source beats a mid-chain
  //      3. tie-break toward lower depth (more upstream), then smaller fan-in
  let keystoneFacetId: string | null = null;
  if (facets.length > 1) {
    const drivers = facets.filter((f) => f.supports > 0);
    if (drivers.length) {
      const score = (f: (typeof facets)[number]) =>
        (f.isRoot ? 10_000 : 0) + // a real root dominates a mid-chain symptom
        (f.supports - f.dependsOn) * 100 + // net downstream leverage
        (maxPathDepth - depthMemo.get(f.id)!) * 5 - // more upstream = closer to source
        f.dependsOn; // fewer things upstream of it
      keystoneFacetId = drivers.slice().sort((a, b) => score(b) - score(a))[0].id;
    }
  }

  // 6. TENSIONS — kept as their own strand.
  const tensions: LiveTension[] = clusterBridges
    .filter((b) => b.relationType === "tension")
    .map((b) => {
      const fa = facetIdOf(b.fragmentAId);
      const fb = facetIdOf(b.fragmentBId);
      return { bridgeId: b.id, facetA: fa, facetB: fb, internal: fa === fb };
    });

  // 7. COVERAGE / wholeness.
  const joined = ids.filter((id) => (facetMembers.get(find(id))?.length ?? 1) > 1).length;
  // wholeness: the fewer, larger the facets (relative to fragment count), the more assembled.
  // 1 facet holding everything = 1.0; every piece its own facet = ~0.
  const total = ids.length;
  const facetCount = facets.length;
  const wholeness = total <= 1 ? 1 : Math.max(0, Math.min(1, (total - facetCount) / (total - 1)));

  // loose fragments: in the cluster but with no confirmed bridge at all
  const touched = new Set<string>();
  for (const b of clusterBridges) {
    touched.add(b.fragmentAId);
    touched.add(b.fragmentBId);
  }
  const looseFragmentIds = ids.filter((id) => !touched.has(id));

  // 8. SPINE — the causal chains, each from a source (nothing drives it) to a sink
  //    (drives nothing), following the longest path. This is what lets the naming model
  //    see "A → B → C" as a story, not just per-side depths. Cycle-safe.
  const sources = facetIds.filter((fid) => (inFacets.get(fid)?.size ?? 0) === 0 && (outFacets.get(fid)?.size ?? 0) > 0);
  const longestFrom = (fid: string, seen: Set<string>): string[] => {
    const outs = [...(outFacets.get(fid) ?? [])].filter((n) => !seen.has(n));
    if (!outs.length) return [fid];
    let best: string[] = [];
    for (const n of outs) {
      const tail = longestFrom(n, new Set([...seen, fid]));
      if (tail.length > best.length) best = tail;
    }
    return [fid, ...best];
  };
  const spine = sources
    .map((s) => longestFrom(s, new Set()))
    .filter((chain) => chain.length >= 2)
    // longest, most-reaching chains first
    .sort((a, b) => b.length - a.length);

  return {
    facets,
    tensions,
    flow,
    spine,
    keystoneFacetId,
    maxDepth: maxPathDepth,
    coverage: {
      total,
      joined,
      facetCount,
      tensionCount: tensions.length,
      wholeness,
    },
    looseFragmentIds,
  };
}
