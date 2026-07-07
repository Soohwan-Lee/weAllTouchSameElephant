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
