/**
 * Small synchronous single-flight gate for user-triggered async work.
 *
 * React state updates are not synchronous, so `disabled={loading}` alone still admits two
 * clicks in the same event turn. This gate closes before the first await and also invalidates
 * late responses after unmount.
 */
export interface RequestGate {
  begin: () => number | null;
  isCurrent: (token: number) => boolean;
  finish: (token: number) => boolean;
  cancel: () => void;
}

export function createRequestGate(): RequestGate {
  let sequence = 0;
  let activeToken: number | null = null;
  return {
    begin() {
      if (activeToken !== null) return null;
      activeToken = ++sequence;
      return activeToken;
    },
    isCurrent(token) {
      return activeToken === token;
    },
    finish(token) {
      if (activeToken !== token) return false;
      activeToken = null;
      return true;
    },
    cancel() {
      sequence++;
      activeToken = null;
    },
  };
}
