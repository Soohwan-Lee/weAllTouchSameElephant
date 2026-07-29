import type { Bridge, Fragment } from "./types";

/**
 * A `separate` bridge asserts that two pieces must NOT be merged. It is a boundary the
 * team drew, not a link — so it must never pull them into the same group, and must never
 * count toward the "one connected group of ≥3" gate. Everything that walks the graph as
 * connection filters through this.
 */
export const isConnecting = (b: Pick<Bridge, "relationType">) => b.relationType !== "separate";

/**
 * One union-find, used by everything in this file that asks "what is joined to what".
 *
 * There were four hand-rolled copies here and they had already drifted — some pre-seeded
 * `parent` and guarded `parent.has(...)`, others initialised lazily inside `find`, and one
 * would recurse forever on an id it had never seen. Four copies of the definition of
 * "connected" is how the gate, the seat panel, and the reveal quietly start disagreeing
 * about the same table.
 *
 * `separate` is excluded by every caller through `isConnecting`, never here — this helper
 * stays dumb about relation types so the boundary rule has exactly one home.
 */
function unionFind(ids: string[]) {
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    // path-compress on the way back, iteratively — a deep chain must not blow the stack
    while (parent.get(x) !== r) {
      const next = parent.get(x)!;
      parent.set(x, r);
      x = next;
    }
    return r;
  };
  return {
    find,
    /** join two ids; ignores anything not on this table rather than inventing a node */
    union(a: string, b: string) {
      if (!parent.has(a) || !parent.has(b)) return;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    },
  };
}

/** Join every id linked by a connecting bridge. The shared first half of every walk below. */
function joinAll(fragments: Fragment[], bridges: Bridge[]) {
  const uf = unionFind(fragments.map((f) => f.id));
  for (const b of bridges) {
    if (isConnecting(b)) uf.union(b.fragmentAId, b.fragmentBId);
  }
  return uf;
}

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
  const { find } = joinAll(fragments, bridges);

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
  const { find } = joinAll(fragments, bridges);
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
  const { find } = joinAll(fragments, bridges);

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

/** One seat the reading never cited, with the pieces of theirs it passed over. */
export interface UncitedSeat {
  /** the seat label, as `seatOf` defines it — never a synthetic `__anon_` id */
  seat: string;
  /** titles of that seat's pieces on the assembled table */
  titles: string[];
}

export interface SeatCitation {
  /** seats the reading reached, via one of their pieces or via a link touching one */
  cited: string[];
  /** seats in the picture the reading reached in neither way */
  uncited: UncitedSeat[];
}

/**
 * WHICH SEATS THE READING ACTUALLY CITED — measured against the seats it could have.
 *
 * `seatCoverage` answers whether the SHAPE reaches people. This answers whether the READING
 * does, and the two come apart: on a table where all five seats are wired into one elephant,
 * the reveal's verdict cites pieces from 3.0 of them on average. The model sees every seat's
 * pieces and cites three. Two prompt revisions moved that number not at all — the same shape
 * as the cross-seat bridge result above, and for the same reason (HiddenBench: collective-
 * reasoning failures persist across prompting strategies). So this is not a retry; it is the
 * gap made visible.
 *
 * Why surface rather than suppress: Parisi & Thain (FAccT 2026) name appearing-included-while-
 * not-being-heard as the worst state a system like this can put someone in — worse than a
 * visible exclusion, because it forecloses the objection. A reading that silently rests on
 * three of five voices produces exactly that. Naming the other two costs the reading nothing
 * and hands the table something to argue with.
 *
 * BOUNDARY — the two halves of the result are scoped DIFFERENTLY, on purpose.
 *
 * `fragments` should be every piece the model could actually cite: the cluster, plus the far
 * ends of boundary links that get carried along for citability. That makes `cited` truthful.
 * Scoping it to the cluster alone dropped a far-end seat the model really had cited, so the
 * logged seat-rate read low exactly when a boundary crossed the cluster edge (measured).
 *
 * `uncited` is then narrowed by `inPicture` to seats holding a piece IN the assembled cluster.
 * An uncited far-end seat belongs to the "Not in this picture" panel, and the one thing this
 * pair of panels must not do is report the same absence twice under two headings that mean
 * different things: your piece never joined the shape (the fix is upstream — go link it)
 * versus your piece IS in the shape and the reading skipped it (the fix is to interrogate the
 * reading). Collapsing them sends someone to argue with a reading that was never the problem.
 *
 * Omit `inPicture` and every named seat in `fragments` is eligible to be reported — right for
 * a caller that passes exactly the cluster and nothing more.
 *
 * Anonymous seats are excluded on both sides. `seatOf` gives an unattributed piece its own
 * synthetic seat so it never merges with another, which is right for counting and wrong here:
 * blank means unknown, and an unknown must not be reported to the room as an unheard person.
 *
 * A cited CONNECTING link counts for both the seats it joins, which is why `citedBridges` is a
 * parameter and not an oversight. Verified against a live run (gpt-4.1): a verdict citing
 * F1, F3, B2, B3 rests on three seats, but analytics is reachable only through B3 — its piece
 * is never cited directly. Counting pieces alone would have printed "analytics: not yet cited"
 * under a reading built on the very link into their piece. That is the false accusation this
 * panel can least afford, since it invites a team to re-argue a voice the reading already used.
 *
 * `separate` is filtered out for the reason it always is here: it is a boundary, not a link.
 * Citing "these two must NOT be merged" says nothing about what either seat contributed, so
 * crediting both ends would silence the panel on exactly the tables it exists for. Measured:
 * one cited piece plus one cited boundary reported nothing uncited while two seats had gone
 * undrawn-on. The filter is `isConnecting`, shared with every other walk in this file, which
 * is why the parameter carries `relationType` rather than just the two endpoints.
 */
export function seatCitation(
  fragments: Fragment[],
  citedFragmentIds: string[],
  citedBridges: Array<Pick<Bridge, "fragmentAId" | "fragmentBId" | "relationType">> = [],
  /** ids of the pieces in the assembled cluster; limits which seats `uncited` may name */
  inPicture?: Set<string>
): SeatCitation {
  const named = fragments.filter((f) => !seatOf(f).startsWith("__anon_"));
  if (!named.length) return { cited: [], uncited: [] };

  const citedIds = new Set(citedFragmentIds);
  // A link's far end can sit outside the cluster; adding its id here is harmless, since only
  // pieces on this table are ever indexed below.
  for (const b of citedBridges) {
    if (!isConnecting(b)) continue;
    citedIds.add(b.fragmentAId);
    citedIds.add(b.fragmentBId);
  }
  const cited = new Set<string>();
  // Keyed only by seats with a piece in the picture — so its keys ARE the reportable seats,
  // and Map insertion order is table order, leaving both lists below in board order.
  const piecesBySeat = new Map<string, string[]>();
  for (const f of named) {
    const s = seatOf(f);
    // Only pieces IN the picture are listed under a seat's name: a far-end piece is not part
    // of what this reading passed over, so naming it here would point at the wrong thing.
    if (!inPicture || inPicture.has(f.id)) {
      if (!piecesBySeat.has(s)) piecesBySeat.set(s, []);
      piecesBySeat.get(s)!.push(f.title);
    }
    // A cited id that matches no piece here (a stale id, or one from outside what the model
    // saw) simply never marks a seat — it cannot, since only these pieces are indexed.
    if (citedIds.has(f.id)) cited.add(s);
  }

  const uncited: UncitedSeat[] = [];
  for (const [seat, titles] of piecesBySeat) {
    if (!cited.has(seat)) uncited.push({ seat, titles });
  }
  return { cited: [...cited], uncited };
}

/**
 * How many confirmed edges are "extra" — i.e. connect two pieces already in the same
 * component when the edge was added. This is |edges| − (|nodes touched| − |components|),
 * the count of cycles in the connection graph. Zero = a clean tree (every edge earns
 * its place); higher = the team is restating relations. Surfaced as a quiet budget,
 * never a block: people may keep a redundant edge on purpose, and that choice is data.
 */
export function countRedundantEdges(bridges: Bridge[]): number {
  // every id these bridges touch — this one is edge-driven, so it seeds from the edges
  const touched = [...new Set(bridges.flatMap((b) => [b.fragmentAId, b.fragmentBId]))];
  const { find, union } = unionFind(touched);
  let redundant = 0;
  for (const b of bridges) {
    if (!isConnecting(b)) continue; // a boundary is not an extra link
    if (find(b.fragmentAId) === find(b.fragmentBId)) redundant++; // closes a cycle
    else union(b.fragmentAId, b.fragmentBId);
  }
  return redundant;
}
