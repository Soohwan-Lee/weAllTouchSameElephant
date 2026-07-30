import type { BridgeContext } from "./prompts";

export function settledPairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join("::");
}

/**
 * Full deterministic exclusion set. Detailed history may be prompt-capped, but these compact
 * keys are cheap enough to carry for the whole table and are the server's final authority.
 */
export function settledPairSet(context?: BridgeContext): Set<string> {
  const settled = new Set<string>();
  for (const key of context?.settledPairKeys ?? []) {
    const [aId, bId, ...extra] = String(key).split("::");
    if (!aId || !bId || extra.length) continue;
    settled.add(settledPairKey(aId, bId));
  }
  // Backward compatibility for older callers without compact keys.
  for (const item of context?.confirmed ?? []) {
    settled.add(settledPairKey(item.aId, item.bId));
  }
  for (const item of context?.rejectedPairs ?? []) {
    settled.add(settledPairKey(item.aId, item.bId));
  }
  return settled;
}
