import assert from "node:assert/strict";

const memory = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
Object.assign(globalThis, { window: { localStorage } });

const { useSession } = await import("../src/lib/store.ts");
const { SCENARIOS } = await import("../src/lib/scenarios.ts");

let passed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn();
  passed++;
  console.log("  ✓", name);
};

console.log("\nsession lifecycle");

await check("session identity and clock begin before the first event", () => {
  useSession.getState().reset();
  const startedAt = useSession.getState().startedAt;
  const sessionId = useSession.getState().sessionId;
  useSession.getState().addFragment({
    authorName: "A",
    authorRole: "role",
    title: "one",
    body: "body",
  });
  const out = useSession.getState().exportSession();
  assert.equal(out.sessionId, sessionId);
  assert.equal(out.startedAt, startedAt);
  assert.ok(out.startedAt <= out.events[0].t);
  assert.ok(out.startedAt <= out.exportedAt);
});

await check("loading a scenario starts a distinct run and resets event sequence", () => {
  const before = useSession.getState().sessionId;
  useSession.getState().loadScenario(SCENARIOS[0], "ko");
  assert.notEqual(useSession.getState().sessionId, before);
  assert.equal(useSession.getState().eventSeq, 0);
  assert.equal(useSession.getState().events.length, 0);
  assert.equal(useSession.getState().lang, "ko");
});

await check("autosave round-trips Set state, tray and navigation", async () => {
  useSession.getState().reset();
  useSession.getState().setStep("gather");
  useSession.getState().addFragment({
    authorName: "A",
    authorRole: "role",
    title: "one",
    body: "body one",
  });
  useSession.getState().addFragment({
    authorName: "B",
    authorRole: "role",
    title: "two",
    body: "body two",
  });
  const [a, b] = useSession.getState().fragments;
  useSession.getState().addProposals([
    {
      fragmentAId: a.id,
      fragmentBId: b.id,
      relationType: "complement",
      explanation: "together",
      evidenceA: "body one",
      evidenceB: "body two",
    },
  ]);
  useSession.getState().rejectBridge(useSession.getState().tray[0].id);
  useSession.getState().setStep("connect");

  const saved = memory.get("watse-session-v3");
  assert.ok(saved?.includes('"__watseType":"Set"'));
  const expectedSessionId = useSession.getState().sessionId;

  useSession.setState({
    sessionId: "",
    startedAt: 0,
    eventSeq: 0,
    step: "start",
    fragments: [],
    tray: [],
    bridges: [],
    events: [],
    rejectedPairKeys: new Set(),
  });
  memory.set("watse-session-v3", saved!);
  await useSession.persist.rehydrate();

  const restored = useSession.getState();
  assert.equal(restored.sessionId, expectedSessionId);
  assert.equal(restored.step, "connect");
  assert.equal(restored.fragments.length, 2);
  assert.equal(restored.rejectedPairKeys.size, 1);
  assert.ok(restored.rejectedPairKeys instanceof Set);
});

console.log(`\n${passed} session-lifecycle assertions passed\n`);
