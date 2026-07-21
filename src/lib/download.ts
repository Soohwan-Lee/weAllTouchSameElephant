import { useSession } from "./store";

/**
 * Download the session as JSON.
 *
 * Lives here rather than in MirrorScreen because export used to be reachable only from the
 * result screen — which requires a connected group of ≥3. A team that argued its way to
 * "these pieces do NOT belong together" could not export at all, so the one outcome most
 * worth reporting was the one outcome that produced no data.
 *
 * The filename carries the session id: two runs of the same scenario used to collide in
 * the Downloads folder and silently overwrite each other.
 */
export function downloadSession() {
  const data = useSession.getState().exportSession();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date(data.exportedAt).toISOString().slice(0, 19).replace(/[:T]/g, "");
  a.download = `watse-${data.scenarioId ?? "custom"}-${data.sessionId}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
