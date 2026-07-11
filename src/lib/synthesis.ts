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
 *   1. FACETS   — pieces fused by "same issue / completes each other" become one side of
 *                 the elephant. (overlap + complement, transitively.)
 *   2. TENSIONS — kept alive as their own strand, never merged away. (Cronin: preserve.)
 *   3. SPINE    — the dependency flow: what a facet rests on vs what it produces.
 *   4. KEYSTONE — the piece the most other facets rest on. A humble, inspectable "if this
 *                 shifts, the most shifts" — NOT a declared root cause.
 *   5. COVERAGE — how much of the table has joined the one shape, and what floats loose.
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
  /** how many other facets depend ON this one (out-degree in the facet flow) */
  supports: number;
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
  /** the facet the most others rest on (or null if the flow is flat) */
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

const isFusing = (r: RelationType) => r === "overlap" || r === "complement";

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

  // 2. FACET FLOW from dependency bridges (A drives B → facet(A) → facet(B)).
  const flowKey = (a: string, b: string) => `${a}->${b}`;
  const flowMap = new Map<string, FacetFlow>();
  const outFacets = new Map<string, Set<string>>();
  roots.forEach((r) => outFacets.set(rootToFacetId.get(r)!, new Set()));
  for (const b of clusterBridges) {
    if (b.relationType !== "dependency") continue;
    const fa = facetIdOf(b.fragmentAId);
    const fb = facetIdOf(b.fragmentBId);
    if (fa === fb) continue; // internal dependency doesn't shape the between-facet flow
    const key = flowKey(fa, fb);
    if (!flowMap.has(key)) flowMap.set(key, { from: fa, to: fb, bridgeIds: [] });
    flowMap.get(key)!.bridgeIds.push(b.id);
    outFacets.get(fa)!.add(fb);
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
    };
  });

  // 5. KEYSTONE — the facet the most others rest on. Prefer highest `supports`,
  //    tie-break by facet size (a bigger shared side), then by lower depth (more root-ward).
  let keystoneFacetId: string | null = null;
  if (facets.length > 1) {
    let bestScore = -1;
    for (const f of facets) {
      const score = f.supports * 100 + f.fragmentIds.length * 10 + (maxPathDepth - f.depth);
      if (f.supports > 0 && score > bestScore) {
        bestScore = score;
        keystoneFacetId = f.id;
      }
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

  return {
    facets,
    tensions,
    flow,
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
