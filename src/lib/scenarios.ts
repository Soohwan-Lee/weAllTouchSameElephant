import type { Scenario } from "./types";

// Pre-baked scenarios so the app works end-to-end with NO API key.
// Each fragment/bridge is bilingual (en/ko). Positions are normalized 0..1.

export const SCENARIOS: Scenario[] = [
  // ─────────────────────────────────────────────────────────────
  {
    id: "audit",
    emoji: "🔐",
    title: {
      en: "Why are enterprise deals stalling?",
      ko: "엔터프라이즈 계약은 왜 막힐까?",
    },
    prompt: {
      en: "A product team meets to decide next quarter's priorities. Everyone sees a different reason things are stuck.",
      ko: "제품팀이 다음 분기 우선순위를 정하려 모였습니다. 각자 막힌 이유를 다르게 보고 있어요.",
    },
    fragments: [
      {
        id: "aud_sales",
        authorName: "Jamie",
        authorRole: { en: "Sales", ko: "영업" },
        title: { en: "Deals stall on security", ko: "보안에서 막히는 계약" },
        body: {
          en: "Enterprise deals stall because security teams ask for clearer audit evidence we can't give.",
          ko: "보안팀이 명확한 감사 증거를 요구하는데 우리가 못 주니 엔터프라이즈 계약이 막혀요.",
        },
        x: 0.2, y: 0.28,
      },
      {
        id: "aud_eng",
        authorName: "Priya",
        authorRole: { en: "Engineering", ko: "엔지니어링" },
        title: { en: "Logging hurts speed", ko: "로깅이 속도를 해침" },
        body: {
          en: "Detailed audit logging could add real latency to our core workflows.",
          ko: "상세한 감사 로깅은 핵심 워크플로에 실질적인 지연을 더할 수 있어요.",
        },
        x: 0.78, y: 0.3,
      },
      {
        id: "aud_support",
        authorName: "Diego",
        authorRole: { en: "Support", ko: "고객지원" },
        title: { en: "Who changed settings?", ko: "누가 설정을 바꿨나" },
        body: {
          en: "Customers keep complaining they can't see who changed their account settings.",
          ko: "고객들이 계정 설정을 누가 바꿨는지 볼 수 없다고 계속 불평해요.",
        },
        x: 0.22, y: 0.72,
      },
      {
        id: "aud_finance",
        authorName: "Mei",
        authorRole: { en: "Finance", ko: "재무" },
        title: { en: "Quarter rides on big deals", ko: "분기는 대형 계약에 달림" },
        body: {
          en: "Next quarter depends on closing a few larger enterprise contracts.",
          ko: "다음 분기는 몇 건의 대형 엔터프라이즈 계약 성사에 달려 있어요.",
        },
        x: 0.5, y: 0.85,
      },
      {
        id: "aud_legal",
        authorName: "Sam",
        authorRole: { en: "Legal", ko: "법무" },
        title: { en: "Regulated customers need traceability", ko: "규제 고객엔 추적성 필요" },
        body: {
          en: "For regulated customers we need much stronger traceability of every change.",
          ko: "규제 대상 고객에겐 모든 변경에 대한 훨씬 강력한 추적성이 필요해요.",
        },
        x: 0.8, y: 0.72,
      },
    ],
    sampleBridges: [
      {
        fragmentAId: "aud_sales",
        fragmentBId: "aud_legal",
        relationType: "dependency",
        explanation: {
          en: "Sales being blocked on 'audit evidence' and Legal needing 'traceability' point to the same missing capability.",
          ko: "영업이 막힌 '감사 증거'와 법무가 필요로 하는 '추적성'은 같은 빠진 기능을 가리켜요.",
        },
        evidenceA: { en: "clearer audit evidence", ko: "명확한 감사 증거" },
        evidenceB: { en: "stronger traceability", ko: "강력한 추적성" },
        confidence: 0.86,
      },
      {
        fragmentAId: "aud_support",
        fragmentBId: "aud_sales",
        relationType: "overlap",
        explanation: {
          en: "Support's 'who changed settings' complaint is the same audit-trail need enterprise buyers ask for.",
          ko: "고객지원의 '누가 설정을 바꿨나' 불만은 엔터프라이즈 구매자가 요구하는 감사 추적 요구와 같아요.",
        },
        evidenceA: { en: "can't see who changed settings", ko: "누가 바꿨는지 볼 수 없음" },
        evidenceB: { en: "audit evidence", ko: "감사 증거" },
        confidence: 0.8,
      },
      {
        fragmentAId: "aud_legal",
        fragmentBId: "aud_eng",
        relationType: "tension",
        explanation: {
          en: "Legal wants tracing of every change, but Engineering warns that heavy logging slows the core product.",
          ko: "법무는 모든 변경 추적을 원하지만, 엔지니어링은 과도한 로깅이 핵심 제품을 느리게 한다고 경고해요.",
        },
        evidenceA: { en: "traceability of every change", ko: "모든 변경의 추적성" },
        evidenceB: { en: "add real latency", ko: "실질적 지연 추가" },
        confidence: 0.83,
      },
      {
        fragmentAId: "aud_finance",
        fragmentBId: "aud_sales",
        relationType: "dependency",
        explanation: {
          en: "Finance's quarter depends on the very enterprise deals that Sales says are blocked on audit evidence.",
          ko: "재무의 분기는 영업이 감사 증거 때문에 막혔다고 말하는 바로 그 엔터프라이즈 계약에 달려 있어요.",
        },
        evidenceA: { en: "depends on larger enterprise contracts", ko: "대형 엔터프라이즈 계약에 달림" },
        evidenceB: { en: "deals stall", ko: "계약이 막힘" },
        confidence: 0.82,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "capstone",
    emoji: "🎓",
    title: {
      en: "Our capstone app keeps slipping",
      ko: "우리 캡스톤 앱이 자꾸 늦어져요",
    },
    prompt: {
      en: "Four students on a graded project each feel a different thing is wrong. The deadline is in two weeks.",
      ko: "성적이 걸린 프로젝트를 하는 네 학생이 각자 다른 문제를 느낍니다. 마감은 2주 뒤예요.",
    },
    fragments: [
      {
        id: "cap_scope",
        authorName: "Ari",
        authorRole: { en: "PM", ko: "기획" },
        title: { en: "Too many features", ko: "기능이 너무 많음" },
        body: {
          en: "We promised too many features and none of them feel finished.",
          ko: "너무 많은 기능을 약속했고 어느 것도 완성된 느낌이 아니에요.",
        },
        x: 0.24, y: 0.3,
      },
      {
        id: "cap_design",
        authorName: "Lena",
        authorRole: { en: "Design", ko: "디자인" },
        title: { en: "Users get lost", ko: "사용자가 길을 잃음" },
        body: {
          en: "In testing, users couldn't figure out the main flow at all.",
          ko: "테스트에서 사용자들이 핵심 흐름을 전혀 이해하지 못했어요.",
        },
        x: 0.76, y: 0.3,
      },
      {
        id: "cap_dev",
        authorName: "Tom",
        authorRole: { en: "Dev", ko: "개발" },
        title: { en: "Rewrites eat our time", ko: "재작업이 시간을 잡아먹음" },
        body: {
          en: "Every time the plan changes I rewrite code, and I'm out of hours.",
          ko: "계획이 바뀔 때마다 코드를 다시 짜는데, 이제 시간이 없어요.",
        },
        x: 0.26, y: 0.72,
      },
      {
        id: "cap_research",
        authorName: "Noor",
        authorRole: { en: "Research", ko: "리서치" },
        title: { en: "We never agreed who it's for", ko: "대상 사용자를 못 정함" },
        body: {
          en: "We still haven't agreed who the app is actually for.",
          ko: "이 앱이 정확히 누구를 위한 건지 아직 합의하지 못했어요.",
        },
        x: 0.74, y: 0.72,
      },
    ],
    sampleBridges: [
      {
        fragmentAId: "cap_research",
        fragmentBId: "cap_scope",
        relationType: "dependency",
        explanation: {
          en: "Not agreeing who the app is for is why the feature list keeps growing — no target means no cut line.",
          ko: "대상 사용자를 못 정했기 때문에 기능 목록이 계속 늘어나요 — 대상이 없으면 자를 기준도 없죠.",
        },
        evidenceA: { en: "haven't agreed who the app is for", ko: "대상 사용자 미합의" },
        evidenceB: { en: "too many features", ko: "너무 많은 기능" },
        confidence: 0.85,
      },
      {
        fragmentAId: "cap_scope",
        fragmentBId: "cap_dev",
        relationType: "dependency",
        explanation: {
          en: "Too many unfinished features force constant plan changes, which is exactly what causes the rewrites.",
          ko: "완성 안 된 기능이 너무 많아 계획이 계속 바뀌고, 그게 바로 재작업의 원인이에요.",
        },
        evidenceA: { en: "none of them feel finished", ko: "완성된 느낌이 아님" },
        evidenceB: { en: "the plan changes I rewrite code", ko: "계획이 바뀌면 코드 재작성" },
        confidence: 0.82,
      },
      {
        fragmentAId: "cap_research",
        fragmentBId: "cap_design",
        relationType: "overlap",
        explanation: {
          en: "Users getting lost and 'who is it for' are the same gap seen twice: an undefined user makes an unclear flow.",
          ko: "사용자가 길을 잃는 것과 '누구를 위한 앱인가'는 같은 공백의 두 모습이에요: 대상이 불명확하면 흐름도 불명확하죠.",
        },
        evidenceA: { en: "who the app is for", ko: "누구를 위한 앱인가" },
        evidenceB: { en: "couldn't figure out the main flow", ko: "핵심 흐름을 이해 못 함" },
        confidence: 0.8,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "park",
    emoji: "🌳",
    title: {
      en: "Should we redesign the neighborhood park?",
      ko: "동네 공원을 새로 바꿔야 할까?",
    },
    prompt: {
      en: "Neighbors gather about the park. Each cares about something different — and it sounds like they disagree.",
      ko: "이웃들이 공원 문제로 모였습니다. 각자 중요하게 여기는 게 다르고, 서로 반대하는 것처럼 들려요.",
    },
    fragments: [
      {
        id: "park_parent",
        authorName: "Rosa",
        authorRole: { en: "Parent", ko: "학부모" },
        title: { en: "Nowhere safe for kids", ko: "아이들이 놀 안전한 곳 없음" },
        body: {
          en: "There's nowhere safe for young kids to play away from the road.",
          ko: "어린아이들이 도로에서 떨어져 안전하게 놀 곳이 없어요.",
        },
        x: 0.22, y: 0.3,
      },
      {
        id: "park_runner",
        authorName: "Kwame",
        authorRole: { en: "Runner", ko: "운동하는 주민" },
        title: { en: "Paths are broken", ko: "산책로가 망가짐" },
        body: {
          en: "The walking paths are cracked and flood whenever it rains.",
          ko: "산책로가 갈라졌고 비만 오면 물이 고여요.",
        },
        x: 0.78, y: 0.3,
      },
      {
        id: "park_senior",
        authorName: "Ingrid",
        authorRole: { en: "Senior resident", ko: "고령 주민" },
        title: { en: "Nowhere to sit", ko: "앉을 곳이 없음" },
        body: {
          en: "There are almost no benches, so older people can't rest on a walk.",
          ko: "벤치가 거의 없어서 나이 든 사람이 산책 중 쉴 수가 없어요.",
        },
        x: 0.24, y: 0.72,
      },
      {
        id: "park_budget",
        authorName: "Hassan",
        authorRole: { en: "Budget-minded", ko: "예산 걱정 주민" },
        title: { en: "We can't fund it all", ko: "전부는 못 함" },
        body: {
          en: "We can't afford a full redesign — we have to pick one thing.",
          ko: "전면 재설계는 감당 못 해요 — 하나만 골라야 해요.",
        },
        x: 0.8, y: 0.72,
      },
    ],
    sampleBridges: [
      {
        fragmentAId: "park_parent",
        fragmentBId: "park_runner",
        relationType: "complement",
        explanation: {
          en: "Broken, flooding paths are part of why there's no safe route away from the road for kids.",
          ko: "갈라지고 물 고이는 길은 아이들이 도로를 피해 안전하게 다닐 길이 없는 이유의 일부예요.",
        },
        evidenceA: { en: "nowhere safe away from the road", ko: "도로에서 떨어진 안전한 곳 없음" },
        evidenceB: { en: "paths are cracked and flood", ko: "길이 갈라지고 물이 고임" },
        confidence: 0.78,
      },
      {
        fragmentAId: "park_senior",
        fragmentBId: "park_runner",
        relationType: "overlap",
        explanation: {
          en: "Benches and walkable paths are two halves of the same thing: a park people can actually move through.",
          ko: "벤치와 걷기 좋은 길은 같은 것의 두 부분이에요: 사람들이 실제로 다닐 수 있는 공원이죠.",
        },
        evidenceA: { en: "no benches to rest", ko: "쉴 벤치 없음" },
        evidenceB: { en: "walking paths", ko: "산책로" },
        confidence: 0.74,
      },
      {
        fragmentAId: "park_budget",
        fragmentBId: "park_parent",
        relationType: "tension",
        explanation: {
          en: "The 'pick one thing' constraint collides with the safety need — but naming it lets the group prioritize, not argue.",
          ko: "'하나만 고르자'는 제약은 안전 요구와 부딪혀요 — 하지만 그걸 드러내면 다투는 대신 우선순위를 정할 수 있어요.",
        },
        evidenceA: { en: "have to pick one thing", ko: "하나만 골라야 함" },
        evidenceB: { en: "nowhere safe for kids", ko: "아이들이 놀 안전한 곳 없음" },
        confidence: 0.8,
      },
    ],
  },
];

export function getScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
