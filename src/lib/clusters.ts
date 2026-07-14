import type { Bridge, Fragment } from "./types";

export interface Cluster {
  id: string;
  fragmentIds: string[];
  bridgeIds: string[];
}

/**
 * Find connected components over confirmed bridges (union-find).
 * A cluster is a set of fragments linked, directly or transitively, by bridges.
 * Only clusters with >= minSize fragments are returned — that's an "elephant".
 */
export function findClusters(
  fragments: Fragment[],
  bridges: Bridge[],
  minSize = 3
): Cluster[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (const f of fragments) parent.set(f.id, f.id);
  for (const b of bridges) {
    if (parent.has(b.fragmentAId) && parent.has(b.fragmentBId)) {
      union(b.fragmentAId, b.fragmentBId);
    }
  }

  const groups = new Map<string, string[]>();
  for (const f of fragments) {
    const root = find(f.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(f.id);
  }

  const clusters: Cluster[] = [];
  let i = 0;
  for (const [root, ids] of groups) {
    if (ids.length < minSize) continue;
    const idSet = new Set(ids);
    const bridgeIds = bridges
      .filter((b) => idSet.has(b.fragmentAId) && idSet.has(b.fragmentBId))
      .map((b) => b.id);
    clusters.push({ id: `cluster_${root}_${i++}`, fragmentIds: ids, bridgeIds });
  }
  // largest first
  clusters.sort((a, b) => b.fragmentIds.length - a.fragmentIds.length);
  return clusters;
}

/**
 * The size of the biggest connected group of fragments over confirmed bridges.
 * This — not the raw bridge count — is what tells us whether an "elephant" can form:
 * three bridges among three separate pairs make no group of 3, but two bridges chaining
 * three pieces do. The reveal needs one group of >= 3, so gate on THIS, not bridges.length.
 */
export function largestClusterSize(fragments: Fragment[], bridges: Bridge[]): number {
  if (!fragments.length) return 0;
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  for (const f of fragments) parent.set(f.id, f.id);
  for (const b of bridges) {
    if (parent.has(b.fragmentAId) && parent.has(b.fragmentBId)) parent.set(find(b.fragmentAId), find(b.fragmentBId));
  }
  const counts = new Map<string, number>();
  for (const f of fragments) {
    const r = find(f.id);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

/**
 * Is B already reachable from A over the given (undirected) bridges — WITHOUT using
 * any bridge in `ignore`? Used to detect a redundant link: if A and B are already
 * connected through other pieces, a new A–B edge adds no NEW connection to the
 * assembled shape — it only restates a relation the team already drew.
 *
 * Why this matters (WATSE 4.7): over-linking is not diligence, it's a symptom of the
 * representational gap — the team re-asserting one relation in several vocabularies
 * (Cronin & Weingart 2007). The minimum edges needed to hold N pieces in one shape is
 * N − (number of groups); every edge beyond that is an extra *claim*, not extra glue.
 */
export function isReachable(
  aId: string,
  bId: string,
  bridges: Bridge[],
  ignore: Set<string> = new Set()
): boolean {
  if (aId === bId) return true;
  const adj = new Map<string, string[]>();
  const add = (x: string, y: string) => {
    if (!adj.has(x)) adj.set(x, []);
    adj.get(x)!.push(y);
  };
  for (const b of bridges) {
    if (ignore.has(b.id)) continue;
    add(b.fragmentAId, b.fragmentBId);
    add(b.fragmentBId, b.fragmentAId);
  }
  const seen = new Set<string>([aId]);
  const stack = [aId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nxt of adj.get(cur) ?? []) {
      if (nxt === bId) return true;
      if (!seen.has(nxt)) {
        seen.add(nxt);
        stack.push(nxt);
      }
    }
  }
  return false;
}

/**
 * How many confirmed edges are "extra" — i.e. connect two pieces already in the same
 * component when the edge was added. This is |edges| − (|nodes touched| − |components|),
 * the count of cycles in the connection graph. Zero = a clean tree (every edge earns
 * its place); higher = the team is restating relations. Surfaced as a quiet budget,
 * never a block: people may keep a redundant edge on purpose, and that choice is data.
 */
export function countRedundantEdges(bridges: Bridge[]): number {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  let redundant = 0;
  for (const b of bridges) {
    const ra = find(b.fragmentAId);
    const rb = find(b.fragmentBId);
    if (ra === rb) redundant++; // both ends already connected → this edge closes a cycle
    else parent.set(ra, rb);
  }
  return redundant;
}
