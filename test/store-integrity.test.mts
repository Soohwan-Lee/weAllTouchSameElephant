import assert from "node:assert/strict";

const memory = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
Object.assign(globalThis, { window: { localStorage } });

const { useSession } = await import("../src/lib/store.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

const proposal = (aId: string, bId: string, explanation: string) => ({
  fragmentAId: aId,
  fragmentBId: bId,
  relationType: "complement" as const,
  explanation,
  evidenceA: "first evidence",
  evidenceB: "second evidence",
});

console.log("\nstore integrity");

check("editing preserves fragment identity and connections while recording before/after", () => {
  useSession.getState().reset();
  useSession.getState().setLang("ko");
  useSession.getState().addFragment({
    authorName: "A",
    authorRole: "role",
    title: "before",
    body: "body before",
  });
  useSession.getState().addFragment({
    authorName: "B",
    authorRole: "role",
    title: "other",
    body: "other body",
  });
  const [a, b] = useSession.getState().fragments;
  useSession.getState().addProposals([proposal(a.id, b.id, "together")]);
  useSession.getState().confirmBridge(useSession.getState().tray[0].id);
  const bridgeId = useSession.getState().bridges[0].id;

  useSession.getState().updateFragment(a.id, {
    title: " after ",
    body: " body after ",
  });

  const state = useSession.getState();
  assert.equal(state.fragments[0].id, a.id);
  assert.equal(state.fragments[0].title, "after");
  assert.equal(state.fragments[0].body, "body after");
  assert.equal(state.fragments[0].createdLang, "ko");
  assert.equal(state.bridges[0].id, bridgeId);
  const event = state.events.at(-1);
  assert.equal(event?.type, "fragment_edited");
  if (event?.type !== "fragment_edited") throw new Error("missing fragment_edited event");
  assert.deepEqual(event.before, { title: "before", body: "body before" });
  assert.deepEqual(event.after, { title: "after", body: "body after" });
  assert.equal(event.lang, "ko");
});

check("deletion records and removes every dangling live reference", () => {
  useSession.getState().reset();
  for (const title of ["one", "two", "three"]) {
    useSession.getState().addFragment({
      authorName: title,
      authorRole: "role",
      title,
      body: `${title} body`,
    });
  }
  const [a, b, c] = useSession.getState().fragments;
  useSession.getState().addProposals([
    proposal(a.id, b.id, "confirmed"),
    proposal(a.id, c.id, "rejected"),
    proposal(b.id, c.id, "pending"),
  ]);
  const [confirmed, rejected] = useSession.getState().tray;
  useSession.getState().confirmBridge(confirmed.id);
  useSession.getState().rejectBridge(rejected.id);
  const rejectedKey = [a.id, c.id].sort().join("::");

  useSession.getState().removeFragment(a.id);

  const state = useSession.getState();
  assert.equal(state.fragments.some((fragment) => fragment.id === a.id), false);
  assert.equal(
    [...state.bridges, ...state.tray].some(
      (bridge) => bridge.fragmentAId === a.id || bridge.fragmentBId === a.id
    ),
    false
  );
  assert.equal(state.rejectedPairKeys.has(rejectedKey), false);
  const event = state.events.at(-1);
  assert.equal(event?.type, "fragment_removed");
  if (event?.type !== "fragment_removed") throw new Error("missing fragment_removed event");
  assert.equal(event.fragment.id, a.id);
  assert.deepEqual(event.removedBridgeIds, [confirmed.id]);
  assert.deepEqual(event.removedRejectedPairKeys, [rejectedKey]);
});

check("export preserves pending work, removed people and a contiguous event clock", () => {
  useSession.getState().reset();
  const participantId = useSession.getState().addParticipant("Kim", "Research");
  useSession.getState().addFragment({
    authorName: "",
    authorRole: "",
    title: "one",
    body: "one body",
  });
  useSession.getState().addFragment({
    authorName: "",
    authorRole: "",
    title: "two",
    body: "two body",
  });
  const [a, b] = useSession.getState().fragments;
  useSession.getState().addProposals([proposal(a.id, b.id, "pending")]);
  useSession.getState().removeParticipant(participantId);

  const out = useSession.getState().exportSession();
  assert.equal(out.version, 3);
  assert.equal(out.participants.length, 0);
  assert.equal(out.removedParticipants[0].id, participantId);
  assert.equal(out.tray.length, 1);
  assert.equal(out.activeParticipantId, null);
  assert.deepEqual(
    out.events.map((event) => event.seq),
    out.events.map((_, index) => index)
  );
  const proposalEvent = out.events.find((event) => event.type === "bridge_proposed");
  assert.equal(proposalEvent?.type, "bridge_proposed");
  if (proposalEvent?.type !== "bridge_proposed") throw new Error("missing proposal snapshot");
  assert.equal(proposalEvent.bridge.id, out.tray[0].id);
});

console.log(`\n${passed} store-integrity assertions passed\n`);
