# 🐘 We All Touch the Same Elephant

*Everyone sees a part. Connect the pieces into one shared picture.*

A calm, minimal web app for a team that needs to make a complex decision together. Each
person drops the **part they see**. Then an AI proposes how the pieces might **connect** —
and the team assembles the whole. The AI never writes a conclusion for you; it only suggests
bridges between fragments. You decide what holds.

Like the parable of the blind men and the elephant: each teammate holds a fragment of the
whole, and everyone argues they're touching a different animal. This tool helps a group
discover that they were touching the **same elephant** all along.

---

## Why this exists

Teams often fail to integrate their views not because information is missing, but because
each person's partial perspective *looks* unrelated, competing, or redundant to the others —
so the pieces never connect. (In the research literature this is called a
**representational gap**; Cronin & Weingart, 2007.) Most AI tools respond by *summarizing*
everyone into one smooth answer, which quietly flattens the very differences that mattered.

**We All Touch the Same Elephant takes the opposite stance:**

- **Fragments stay visible.** The AI never replaces anyone's words with a summary.
- **The AI proposes connections, not conclusions.** Its only move is to suggest a bridge
  between two pieces.
- **Humans assemble the whole** by confirming, editing, or dismissing each bridge.
- **Integrate differences without erasing them.** The final shape fuses genuinely-same
  pieces into facets but keeps real tensions alive as their own strand — it never collapses
  the group into one winner.
- **The summary comes last, as a mirror.** Only after the team has connected things does the
  AI reflect back the shape they built — never as an opening move that would anchor them.

---

## How it works (3 steps)

1. **Gather** — each person adds short fragments (a concern, a fact, a constraint).
2. **Connect** — press *Suggest connections*. The AI offers a handful of bridges at a time
   (scaled to how many pieces are on the table), each with a relation type
   (*overlap · tension · dependency · complement*) and short evidence from both pieces.
   Confirm, tweak, or dismiss each.
3. **See the whole** — once ≥3 bridges are confirmed, reveal the **shape your pieces make**.

Try it instantly with a **ready-made sample scenario** — no setup, no typing required.

### What "the whole shape" actually shows

The reveal isn't a summary and it isn't a single crowned "bottleneck." A **synthesis engine**
reads your confirmed connections and lays out the shape the pieces make together:

- **Facets** — pieces you linked as *overlap* or *complement* fuse into one **side of the
  elephant** ("these four were the same thing seen differently").
- **Spine** — *dependency* links arrange the facets from root pressures → visible symptoms.
- **Keystone** — the side the most others rest on gets a gentle halo. It's an inspectable
  starting point to argue with, **not** a declared root cause.
- **Live tensions** — *tension* links are kept as their own strand, never resolved away
  (integrating differences means preserving them — Cronin & Weingart, 2007).
- **Coverage** — how assembled the picture is, and which pieces are still floating alone.

Only *after* this shape is built does the AI mirror back a **name** for the elephant and the
single highest-leverage **question** to answer next — never an answer, never an opening move.

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS** for a modern, minimal interface
- **Zustand** for session state
- **OpenAI API** (`gpt-5.4-mini`) for bridge proposals and the mirror reflection
- Deploys to **Vercel** out of the box

Bilingual throughout: **English / 한국어** toggle in the header.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | optional | Enables **live** AI bridge suggestions. Without it, the app runs in **sample mode** and uses each scenario's pre-baked bridges — so the whole experience still works end to end. |
| `OPENAI_MODEL` | optional | Overrides the model. Default: `gpt-5.4-mini`. |

> **Sample mode is a first-class experience.** With no key, the three built-in scenarios
> demonstrate the full flow (fragments → bridges → assembly → mirror). Add a key to run it on
> your own fragments with real AI suggestions.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (framework auto-detected as Next.js).
3. Add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in **Project → Settings →
   Environment Variables**.
4. Deploy.

No other configuration needed.

---

## Project structure

```
src/
  app/
    page.tsx              # step router (start → gather → connect → mirror)
    api/bridges/route.ts  # AI bridge proposals (falls back to sample mode)
    api/name/route.ts     # AI name + "so the real question is…" (after assembly)
    api/mirror/route.ts   # AI "mirror" reflection (falls back to local mirror)
  components/             # Header, StartScreen, Tour, Gather/Connect/Mirror,
                          # PuzzleCanvas, BridgeCard, SynthesisCanvas, SynthesisSummary
  lib/
    types.ts             # Fragment, Bridge, Scenario data model
    store.ts             # Zustand session store
    clusters.ts          # connected-components (which pieces form an "elephant")
    synthesis.ts         # synthesis engine: facets, spine, keystone, tensions, coverage
    scenarios.ts         # four bilingual sample scenarios with pre-baked bridges
    prompts.ts           # LLM prompts (bridge + name + mirror)
    i18n.tsx             # EN/KO strings + toggle
```

---

## Design principles

- **The AI is a bridge-proposer, never an author.** If it ever summarizes first, it becomes
  an anchor and the team stops thinking. Order matters: propose → assemble → mirror.
- **No heavy notation.** No diagrams to learn, no formal grammar. Just cards and connections.
- **Beginner-friendly.** A 30-second tour, ready-made examples, and gentle empty states so a
  first-time user is never lost.

---

Built as a research prototype for the *We All Touch the Same Elephant* project.
