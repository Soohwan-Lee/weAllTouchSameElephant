import type { Bridge, Fragment } from "./types";

/**
 * A `separate` bridge asserts that two pieces must NOT be merged. It is a boundary the
 * team drew, not a link — so it must never pull them into the same group, and must never
 * count toward the "one connected group of ≥3" gate. Everything that walks the graph as
 * connection filters through this.
 */
export const isConnecting = (b: Bridge) => b.relationType !== "separate";

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
    if (!isConnecting(b)) continue;
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
  for (const [, ids] of groups) {
    if (ids.length < minSize) continue;
    const idSet = new Set(ids);
    const bridgeIds = bridges
      .filter((b) => isConnecting(b) && idSet.has(b.fragmentAId) && idSet.has(b.fragmentBId))
      .map((b) => b.id);
    // Identify a cluster by its SMALLEST member id — stable under growth. The old
    // `cluster_${root}_${i}` changed whenever a bridge was added (both the union-find root
    // and the size ordering shift), and clusterNames/Questions/Decisions are keyed by this,
    // so a team that named the elephant, went back, and linked one more piece silently lost
    // their name. A content hash would have the same flaw; the min-id survives absorption
    // as long as the founding piece stays, which is what "the same elephant" means here.
    const anchorId = [...ids].sort()[0];
    clusters.push({ id: `cluster_${anchorId}`, fragmentIds: ids, bridgeIds });
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
    if (!isConnecting(b)) continue;
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
    if (ignore.has(b.id) || !isConnecting(b)) continue;
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

/** Whose piece this is. Falls back to the piece's own id so an unattributed fragment
 *  counts as its own seat rather than silently merging with every other unattributed one. */
export const seatOf = (f: Fragment) => f.authorName || f.authorRole || `__anon_${f.id}`;

/**
 * SEAT COVERAGE — how many PEOPLE the assembled shape actually reaches.
 *
 * The gate that guards the reveal counts PIECES (`largestClusterSize >= 3`). That is not the
 * same question, and the difference is the whole problem this tool exists to solve: a table of
 * six pieces from four people, where every link sits inside one person's three pieces, passes
 * the piece gate with ONE seat connected. The picture looks assembled and is one voice.
 *
 * This is measured, not assumed — see test/seats.test.mts. It is also what the reveal was
 * quietly failing on: a tension-only table reached 2.0 of 5 seats, always the same two,
 * because the model can only read across links the team actually drew.
 *
 * Why coverage and not airtime: Lu, Yuan & McLeod's meta-analysis (2012; 65 studies, 3,189
 * groups) found information COVERAGE — whether a unique item surfaces at all — predicts
 * decision quality more strongly than discussion FOCUS, how much airtime it gets. So the
 * number worth optimizing is how many seats are in the shape at all, not how evenly the
 * links are spread among them.
 */
export interface SeatCoverage {
  /** distinct seats with at least one piece on the table */
  total: number;
  /** distinct seats present in the largest connected group */
  connected: number;
  /** seat labels with no connecting link to anyone else's piece — the unheard */
  isolated: string[];
}

export function seatCoverage(fragments: Fragment[], bridges: Bridge[]): SeatCoverage {
  if (!fragments.length) return { total: 0, connected: 0, isolated: [] };
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  for (const f of fragments) parent.set(f.id, f.id);
  for (const b of bridges) {
    if (!isConnecting(b)) continue;
    if (parent.has(b.fragmentAId) && parent.has(b.fragmentBId)) {
      parent.set(find(b.fragmentAId), find(b.fragmentBId));
    }
  }

  // seats per component, and the component sizes, in one pass
  const seatsByRoot = new Map<string, Set<string>>();
  const sizeByRoot = new Map<string, number>();
  for (const f of fragments) {
    const r = find(f.id);
    if (!seatsByRoot.has(r)) seatsByRoot.set(r, new Set());
    seatsByRoot.get(r)!.add(seatOf(f));
    sizeByRoot.set(r, (sizeByRoot.get(r) ?? 0) + 1);
  }

  let bestRoot: string | null = null;
  for (const [r, n] of sizeByRoot) {
    if (bestRoot === null || n > sizeByRoot.get(bestRoot)!) bestRoot = r;
  }

  // A seat is "heard" only if one of its pieces links to a piece from a DIFFERENT seat.
  // Linking your own two notes together is not being heard by the table.
  const crossed = new Set<string>();
  const byId = new Map(fragments.map((f) => [f.id, f]));
  for (const b of bridges) {
    if (!isConnecting(b)) continue;
    const a = byId.get(b.fragmentAId);
    const c = byId.get(b.fragmentBId);
    if (!a || !c) continue;
    const sa = seatOf(a);
    const sc = seatOf(c);
    if (sa !== sc) {
      crossed.add(sa);
      crossed.add(sc);
    }
  }
  const allSeats = new Set(fragments.map(seatOf));
  const isolated = [...allSeats].filter((s) => !crossed.has(s) && !s.startsWith("__anon_"));

  return {
    total: allSeats.size,
    connected: bestRoot ? seatsByRoot.get(bestRoot)!.size : 0,
    isolated,
  };
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
    if (!isConnecting(b)) continue; // a boundary is not an extra link
    const ra = find(b.fragmentAId);
    const rb = find(b.fragmentBId);
    if (ra === rb) redundant++; // both ends already connected → this edge closes a cycle
    else parent.set(ra, rb);
  }
  return redundant;
}
