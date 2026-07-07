import type { Bridge, Fragment } from "./types";
import type { Cluster } from "./clusters";

export interface CruxNode {
  fragmentId: string;
  degree: number; // total confirmed connections
  downstream: number; // # of dependency arrows pointing OUT (this drives others)
  level: number; // 0 = most upstream (root), higher = downstream (symptom)
  isCrux: boolean;
}

export interface CruxLayout {
  nodes: CruxNode[];
  cruxId: string | null;
  /** directed edges from dependency bridges: from → to (from drives to) */
  flow: Array<{ bridgeId: string; from: string; to: string }>;
  maxLevel: number;
}

/**
 * Compute a "crux" layout for a cluster:
 * - degree = how many confirmed bridges touch a fragment
 * - dependency bridges are directional: fragmentA drives fragmentB
 *   (in our data, dependency means A affects/causes/blocks/enables B)
 * - level = longest dependency path from a root → downstream depth
 * - crux = the fragment with the highest (downstream, degree) — the pivot that,
 *   if resolved, unlocks the most. This is a HUMBLE suggestion, editable by the team.
 */
export function computeCrux(
  fragments: Fragment[],
  bridges: Bridge[],
  cluster: Cluster,
  overrideCruxId?: string | null
): CruxLayout {
  const ids = new Set(cluster.fragmentIds);
  const clusterBridges = bridges.filter(
    (b) => ids.has(b.fragmentAId) && ids.has(b.fragmentBId)
  );

  const degree = new Map<string, number>();
  const downstream = new Map<string, number>();
  cluster.fragmentIds.forEach((id) => {
    degree.set(id, 0);
    downstream.set(id, 0);
  });

  const flow: Array<{ bridgeId: string; from: string; to: string }> = [];
  const outEdges = new Map<string, string[]>();
  cluster.fragmentIds.forEach((id) => outEdges.set(id, []));

  for (const b of clusterBridges) {
    degree.set(b.fragmentAId, (degree.get(b.fragmentAId) ?? 0) + 1);
    degree.set(b.fragmentBId, (degree.get(b.fragmentBId) ?? 0) + 1);
    if (b.relationType === "dependency") {
      // A drives B
      flow.push({ bridgeId: b.id, from: b.fragmentAId, to: b.fragmentBId });
      outEdges.get(b.fragmentAId)!.push(b.fragmentBId);
      downstream.set(b.fragmentAId, (downstream.get(b.fragmentAId) ?? 0) + 1);
    }
  }

  // longest-path level via DFS over dependency edges (cycle-safe)
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const dfs = (id: string): number => {
    if (level.has(id)) return level.get(id)!;
    if (visiting.has(id)) return 0; // break cycle
    visiting.add(id);
    let d = 0;
    for (const nxt of outEdges.get(id) ?? []) d = Math.max(d, 1 + dfs(nxt));
    visiting.delete(id);
    level.set(id, d);
    return d;
  };
  cluster.fragmentIds.forEach((id) => dfs(id));

  // level as depth-from-root: invert so upstream(drivers) get LOW level.
  const maxDepth = Math.max(0, ...cluster.fragmentIds.map((id) => level.get(id) ?? 0));
  const nodeLevel = new Map<string, number>();
  cluster.fragmentIds.forEach((id) => nodeLevel.set(id, maxDepth - (level.get(id) ?? 0)));

  // crux pick: prefer override, else highest downstream, tiebreak by degree
  let cruxId: string | null = overrideCruxId ?? null;
  if (!cruxId) {
    let best = -1;
    for (const id of cluster.fragmentIds) {
      const score = (downstream.get(id) ?? 0) * 10 + (degree.get(id) ?? 0);
      if (score > best) {
        best = score;
        cruxId = id;
      }
    }
  }

  const nodes: CruxNode[] = cluster.fragmentIds.map((id) => ({
    fragmentId: id,
    degree: degree.get(id) ?? 0,
    downstream: downstream.get(id) ?? 0,
    level: nodeLevel.get(id) ?? 0,
    isCrux: id === cruxId,
  }));

  return { nodes, cruxId, flow, maxLevel: maxDepth };
}
