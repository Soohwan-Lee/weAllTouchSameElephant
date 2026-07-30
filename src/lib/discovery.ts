import type { Bridge, Fragment, Participant } from "./types";

export type DiscoveryNext = "collect" | "cross" | "cause" | "challenge" | "reflect";

export interface DiscoveryProgress {
  contributed: number;
  participantTotal: number;
  crossSeatLinks: number;
  causalLinks: number;
  challengeLinks: number;
  next: DiscoveryNext;
}

/**
 * A process compass, not a quality score.
 *
 * The four counts expose different failure modes that a raw "3 pieces connected" gate cannot:
 * an absent seat, one person connecting only to themselves, a shape with no claimed direction,
 * and a picture nobody has tried to challenge. None is enforced because a real situation may
 * honestly contain no causal claim or tension.
 */
export function discoveryProgress(
  fragments: Fragment[],
  bridges: Bridge[],
  participants: Participant[]
): DiscoveryProgress {
  const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const contributedIds = new Set(
    fragments.flatMap((fragment) => (fragment.authorId ? [fragment.authorId] : []))
  );
  let crossSeatLinks = 0;
  for (const bridge of bridges) {
    const a = byId.get(bridge.fragmentAId);
    const b = byId.get(bridge.fragmentBId);
    if (a?.authorId && b?.authorId && a.authorId !== b.authorId) crossSeatLinks++;
  }
  const causalLinks = bridges.filter((bridge) => bridge.relationType === "dependency").length;
  const challengeLinks = bridges.filter(
    (bridge) => bridge.relationType === "tension" || bridge.relationType === "separate"
  ).length;
  const contributed = participants.filter((participant) =>
    contributedIds.has(participant.id)
  ).length;

  let next: DiscoveryNext = "reflect";
  if (participants.length > 1 && contributed < participants.length) next = "collect";
  else if (participants.length > 1 && crossSeatLinks === 0) next = "cross";
  else if (bridges.length > 0 && causalLinks === 0) next = "cause";
  else if (bridges.length > 0 && challengeLinks === 0) next = "challenge";

  return {
    contributed,
    participantTotal: participants.length,
    crossSeatLinks,
    causalLinks,
    challengeLinks,
    next,
  };
}
