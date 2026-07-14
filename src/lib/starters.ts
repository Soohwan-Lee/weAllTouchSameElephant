// Input scaffolding for the FIRST bottleneck: "what do I even write on my card?"
//
// The tool assumed people arrive holding a ready fragment. In practice the blank body
// is where they freeze. These starters lower that barrier WITHOUT writing the fragment
// for them — the perspective must stay the person's own, or the "everyone touched a
// different side" premise (Cronin & Weingart representational gaps) becomes an artifact.
//
// Three scaffolds, weakest → strongest intervention:
//  1. piece TYPES — what KIND of thing a card can be (symptom / worry / dependency /
//     outcome). Mirrors the relation model so the input is shaped like the synthesis.
//  2. role LENSES — perspective-eliciting questions tuned per role, so a team's cards
//     diverge by seat (feeds the multi-stakeholder divergence from WATSE 4.7).
//  3. per-type prompt + sentence FRAME — a rotating question and a fill-in skeleton the
//     person completes in their own words.

import type { TKey } from "./i18n";

export type PieceType = "symptom" | "worry" | "dependency" | "outcome";

export const PIECE_TYPES: PieceType[] = ["symptom", "worry", "dependency", "outcome"];

export interface PieceTypeMeta {
  emoji: string;
  labelKey: TKey;
  /** a rotating perspective-eliciting question (blank body → a question to answer) */
  prompt: { en: string; ko: string };
  /** a fill-in sentence skeleton the person completes in their OWN words */
  frame: { en: string; ko: string };
  /** short placeholder for the title field */
  titleHint: { en: string; ko: string };
}

export const PIECE_TYPE_META: Record<PieceType, PieceTypeMeta> = {
  symptom: {
    emoji: "🩹",
    labelKey: "ptype.symptom",
    prompt: {
      en: "From where you sit, what's the thing that keeps going wrong?",
      ko: "당신 자리에서, 자꾸 잘못되는 그 하나는 무엇인가요?",
    },
    frame: {
      en: "We keep seeing ___, and it shows up as ___.",
      ko: "___가 자꾸 보이고, 그건 ___로 드러나요.",
    },
    titleHint: { en: "e.g. Deals stall on security", ko: "예: 보안에서 막히는 계약" },
  },
  worry: {
    emoji: "⚠️",
    labelKey: "ptype.worry",
    prompt: {
      en: "What are you quietly worried about that others might not be?",
      ko: "다른 사람은 아닐 수도 있는데, 당신이 조용히 걱정하는 건?",
    },
    frame: {
      en: "I'm worried that ___, because ___.",
      ko: "저는 ___가 걱정돼요, 왜냐하면 ___.",
    },
    titleHint: { en: "e.g. Quality could slip", ko: "예: 품질이 떨어질 수도" },
  },
  dependency: {
    emoji: "🔗",
    labelKey: "ptype.dependency",
    prompt: {
      en: "What does your part depend on — or what's blocked until something else happens?",
      ko: "당신의 부분은 무엇에 달려 있나요 — 또는 무엇이 되기 전엔 막혀 있나요?",
    },
    frame: {
      en: "___ can't move until ___.",
      ko: "___는 ___ 전엔 움직일 수 없어요.",
    },
    titleHint: { en: "e.g. No on-call on weekends", ko: "예: 주말 당직이 없음" },
  },
  outcome: {
    emoji: "🎯",
    labelKey: "ptype.outcome",
    prompt: {
      en: "If this isn't fixed, what happens next — to you, or to the work?",
      ko: "이게 안 고쳐지면 다음엔 무슨 일이 생기나요 — 당신에게, 또는 일에?",
    },
    frame: {
      en: "If ___ stays, then ___ will follow.",
      ko: "___가 계속되면, ___가 따라올 거예요.",
    },
    titleHint: { en: "e.g. Churn is creeping up", ko: "예: 이탈이 늘고 있음" },
  },
};

/**
 * Role lenses — a role name + perspective questions that come from THAT seat.
 * Selecting a role swaps in questions that pull the person's own vantage forward,
 * so a team's cards diverge by role instead of converging on one framing.
 * The list is illustrative, not exhaustive; "other" keeps the generic prompts.
 */
export interface RoleLens {
  id: string;
  label: { en: string; ko: string };
  questions: Array<{ en: string; ko: string }>;
}

export const ROLE_LENSES: RoleLens[] = [
  {
    id: "generic",
    label: { en: "Anyone", ko: "누구나" },
    questions: [
      { en: "What do you see that others on the team might not?", ko: "팀의 다른 사람은 못 보는데 당신은 보는 게 있나요?" },
      { en: "What's the part of this you deal with directly?", ko: "이 문제에서 당신이 직접 부딪히는 부분은?" },
    ],
  },
  {
    id: "frontline",
    label: { en: "Frontline / doer", ko: "실무자" },
    questions: [
      { en: "What breaks in the actual day-to-day work?", ko: "실제 일상 업무에서 무엇이 깨지나요?" },
      { en: "What do you spend time on that shouldn't be needed?", ko: "필요 없어야 하는데 시간을 쓰는 건?" },
    ],
  },
  {
    id: "customer",
    label: { en: "Customer-facing", ko: "고객 접점" },
    questions: [
      { en: "What do customers/users complain about most?", ko: "고객·사용자가 가장 자주 불평하는 건?" },
      { en: "What are you afraid to promise them right now?", ko: "지금 그들에게 약속하기 두려운 건?" },
    ],
  },
  {
    id: "lead",
    label: { en: "Lead / decision-maker", ko: "리더·결정권자" },
    questions: [
      { en: "What trade-off are you being forced to make?", ko: "지금 강요받고 있는 트레이드오프는?" },
      { en: "What would you fix first if you could only fix one?", ko: "딱 하나만 고칠 수 있다면 먼저 고칠 건?" },
    ],
  },
  {
    id: "builder",
    label: { en: "Builder / technical", ko: "제작·기술" },
    questions: [
      { en: "What's fragile under the hood that others don't see?", ko: "남들은 못 보는, 내부에서 취약한 건?" },
      { en: "What did we build that's now costing us?", ko: "우리가 만든 것 중 지금 비용이 되는 건?" },
    ],
  },
];

/**
 * The fill-in FRAME for a chosen type — a sentence skeleton the person completes in
 * their own words. This kills the blank field without generating the content: the blanks
 * (___) are theirs to fill. No model, deterministic.
 */
export function starterFrame(type: PieceType, lang: "en" | "ko"): string {
  return PIECE_TYPE_META[type].frame[lang];
}
