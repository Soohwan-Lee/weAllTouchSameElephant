import type { Scenario } from "./types";

// Pre-baked scenarios so the app works end-to-end with NO API key.
// Each fragment/bridge is bilingual (en/ko). Positions are normalized 0..1.
//
// Design note: every scenario is tuned to assemble well in the synthesis engine —
// overlap/complement bridges fuse pieces into 2–3 clear FACETS ("sides of the
// elephant"), dependency bridges lay down a root→symptom SPINE, and 1–2 tension
// bridges stay alive as their own strand. Roles are differentiated so the partial
// views are genuinely different (role-differentiated stakes, per WATSE v4/v5).

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
        x: 0.18, y: 0.24,
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
        x: 0.8, y: 0.26,
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
        x: 0.16, y: 0.56,
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
        x: 0.5, y: 0.86,
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
        x: 0.82, y: 0.58,
      },
      {
        id: "aud_pm",
        authorName: "Lea",
        authorRole: { en: "Product", ko: "프로덕트" },
        title: { en: "Audit keeps losing the roadmap", ko: "감사 기능이 로드맵에서 밀림" },
        body: {
          en: "Audit trails keep getting bumped off the roadmap by flashier features.",
          ko: "감사 추적 기능은 더 화려한 기능들에 밀려 로드맵에서 계속 빠져요.",
        },
        x: 0.5, y: 0.14,
      },
      {
        id: "aud_cs",
        authorName: "Tomas",
        authorRole: { en: "Customer Success", ko: "고객 성공" },
        title: { en: "Renewals cite trust", ko: "갱신 때 '신뢰'가 걸림" },
        body: {
          en: "At renewal, big accounts say they don't fully trust our change history.",
          ko: "갱신 시점에 큰 계정들이 우리 변경 이력을 완전히 신뢰하지 못한다고 말해요.",
        },
        x: 0.34, y: 0.72,
      },
      {
        id: "aud_security",
        authorName: "Nadia",
        authorRole: { en: "Security", ko: "보안" },
        title: { en: "No tamper-proof record", ko: "위변조 방지 기록 없음" },
        body: {
          en: "We have no tamper-proof record of who did what, which fails most security reviews.",
          ko: "누가 무엇을 했는지 위변조 불가한 기록이 없어서 대부분의 보안 심사를 통과 못 해요.",
        },
        x: 0.66, y: 0.72,
      },
    ],
    sampleBridges: [
      // FACET A: the missing audit-trail capability (sales / legal / support / cs / security fuse)
      {
        fragmentAId: "aud_sales",
        fragmentBId: "aud_legal",
        relationType: "overlap",
        explanation: {
          en: "Sales being blocked on 'audit evidence' and Legal needing 'traceability' are the same missing capability.",
          ko: "영업이 막힌 '감사 증거'와 법무가 필요로 하는 '추적성'은 같은 빠진 기능이에요.",
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
          en: "Support's 'who changed settings' is the same audit-trail need enterprise buyers ask for.",
          ko: "고객지원의 '누가 설정을 바꿨나'는 엔터프라이즈 구매자가 요구하는 감사 추적 요구와 같아요.",
        },
        evidenceA: { en: "can't see who changed settings", ko: "누가 바꿨는지 볼 수 없음" },
        evidenceB: { en: "audit evidence", ko: "감사 증거" },
        confidence: 0.8,
      },
      {
        fragmentAId: "aud_security",
        fragmentBId: "aud_legal",
        relationType: "overlap",
        explanation: {
          en: "A tamper-proof record IS the traceability Legal is describing — same capability, security's words.",
          ko: "위변조 방지 기록은 곧 법무가 말하는 추적성이에요 — 같은 기능을 보안 언어로 말한 것.",
        },
        evidenceA: { en: "no tamper-proof record", ko: "위변조 방지 기록 없음" },
        evidenceB: { en: "traceability of every change", ko: "모든 변경의 추적성" },
        confidence: 0.85,
      },
      {
        fragmentAId: "aud_cs",
        fragmentBId: "aud_support",
        relationType: "complement",
        explanation: {
          en: "Renewal 'trust in change history' and support's visibility complaint complete one another: same trail, two moments.",
          ko: "갱신 때 '변경 이력 신뢰'와 고객지원의 가시성 불만은 서로를 보완해요: 같은 이력, 두 순간.",
        },
        evidenceA: { en: "don't trust our change history", ko: "변경 이력을 신뢰 못 함" },
        evidenceB: { en: "can't see who changed", ko: "누가 바꿨는지 못 봄" },
        confidence: 0.78,
      },
      // SPINE: the capability drives revenue outcomes
      {
        fragmentAId: "aud_sales",
        fragmentBId: "aud_finance",
        relationType: "dependency",
        explanation: {
          en: "Finance's quarter depends on the very enterprise deals that stall on audit evidence.",
          ko: "재무의 분기는 감사 증거 때문에 막히는 바로 그 엔터프라이즈 계약에 달려 있어요.",
        },
        evidenceA: { en: "deals stall", ko: "계약이 막힘" },
        evidenceB: { en: "depends on larger enterprise contracts", ko: "대형 계약에 달림" },
        confidence: 0.82,
      },
      {
        fragmentAId: "aud_pm",
        fragmentBId: "aud_sales",
        relationType: "dependency",
        explanation: {
          en: "Because audit keeps losing the roadmap, the capability never ships — which is why deals stall.",
          ko: "감사 기능이 로드맵에서 계속 밀리니 기능이 출시 안 되고, 그래서 계약이 막혀요.",
        },
        evidenceA: { en: "bumped off the roadmap", ko: "로드맵에서 빠짐" },
        evidenceB: { en: "deals stall", ko: "계약이 막힘" },
        confidence: 0.79,
      },
      {
        fragmentAId: "aud_security",
        fragmentBId: "aud_cs",
        relationType: "dependency",
        explanation: {
          en: "No tamper-proof record is exactly why renewals cite shaky trust in the history.",
          ko: "위변조 방지 기록이 없는 것이 갱신 때 이력 신뢰가 흔들리는 바로 그 이유예요.",
        },
        evidenceA: { en: "no tamper-proof record", ko: "위변조 방지 기록 없음" },
        evidenceB: { en: "don't fully trust our change history", ko: "변경 이력을 신뢰 못 함" },
        confidence: 0.77,
      },
      // TENSION: the fix collides with performance (kept alive)
      {
        fragmentAId: "aud_legal",
        fragmentBId: "aud_eng",
        relationType: "tension",
        explanation: {
          en: "Legal wants tracing of every change, but Engineering warns heavy logging slows the core product.",
          ko: "법무는 모든 변경 추적을 원하지만, 엔지니어링은 과도한 로깅이 핵심 제품을 느리게 한다고 경고해요.",
        },
        evidenceA: { en: "traceability of every change", ko: "모든 변경의 추적성" },
        evidenceB: { en: "add real latency", ko: "실질적 지연 추가" },
        confidence: 0.83,
      },
    ],
    reveal: {
      name: { en: "The missing paper trail", ko: "사라진 감사 추적" },
      note: {
        en: "Five roles named the same absent capability in five vocabularies.",
        ko: "다섯 역할이 같은 '없는 기능'을 다섯 가지 말로 부른 거예요.",
      },
      readings: [
        {
          en: "It's a product-priority story: an unglamorous audit trail keeps losing the roadmap, so revenue quietly bleeds.",
          ko: "이건 우선순위 이야기예요: 화려하지 않은 감사 추적이 계속 로드맵에서 밀려서 매출이 조용히 새요.",
        },
        {
          en: "It's a trust story: without a tamper-proof record, buyers and renewals just don't believe your change history.",
          ko: "이건 신뢰 이야기예요: 위변조 방지 기록이 없으니 구매자도 갱신 고객도 변경 이력을 안 믿어요.",
        },
        {
          en: "It's an architecture bet: the same feature that unlocks deals is the one Engineering says will slow the core.",
          ko: "이건 아키텍처 내기예요: 계약을 여는 바로 그 기능이 엔지니어링이 코어를 느리게 한다고 말하는 그거예요.",
        },
      ],
      hypothesis: {
        en: "Maybe the real core isn't security at all — it's that a tamper-proof change log was never owned on the roadmap. If so, you'd expect every 'stuck deal' to trace back to the same missing artifact, and shipping it once would clear Sales, Legal, Support and renewals together.",
        ko: "어쩌면 진짜 핵심은 보안이 아니라, 위변조 방지 변경 로그를 로드맵에서 아무도 책임지지 않은 거예요. 그렇다면 모든 '막힌 계약'이 같은 빠진 기능으로 수렴하고, 그걸 한 번 출시하면 영업·법무·지원·갱신이 한꺼번에 풀릴 거예요.",
      },
      verdict: {
        en: "The core isn't security — it's that audit was never treated as a real deliverable, so it keeps losing the roadmap. Everything downstream (stalled deals, shaky trust, lost renewals) is the cost of that one unmade priority call. The tamper-proof log is a symptom of it, not the root.",
        ko: "핵심은 보안이 아니라 — 감사 기능을 제대로 된 산출물로 취급한 적이 없어서 로드맵에서 계속 밀린다는 거예요. 그 아래 모든 것(막힌 계약·흔들리는 신뢰·잃은 갱신)이 그 안 내린 우선순위 결정 하나의 대가예요. 위변조 로그는 그 뿌리가 아니라 증상이고요.",
      },
      question: {
        en: "So the real question is: what would it take to make audit a protected, owned roadmap item this quarter — instead of the thing that flashier features keep bumping?",
        ko: "그래서 진짜 질문은: 이번 분기에 감사 기능을 더 화려한 기능에 밀리지 않는, 주인 있는 보호된 로드맵 항목으로 만들려면 무엇이 필요한가?",
      },
    },
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
      en: "Students on a graded project each feel a different thing is wrong. The deadline is in two weeks.",
      ko: "성적이 걸린 프로젝트를 하는 학생들이 각자 다른 문제를 느낍니다. 마감은 2주 뒤예요.",
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
        x: 0.24, y: 0.24,
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
        x: 0.78, y: 0.24,
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
        x: 0.22, y: 0.56,
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
        x: 0.5, y: 0.12,
      },
      {
        id: "cap_demo",
        authorName: "Sofia",
        authorRole: { en: "Presenter", ko: "발표 담당" },
        title: { en: "Demo has no story", ko: "데모에 이야기가 없음" },
        body: {
          en: "I can't build a demo story because I don't know what problem we're actually solving.",
          ko: "우리가 실제로 무슨 문제를 푸는지 몰라서 데모 스토리를 못 짜겠어요.",
        },
        x: 0.8, y: 0.56,
      },
      {
        id: "cap_qa",
        authorName: "Ken",
        authorRole: { en: "QA", ko: "QA" },
        title: { en: "Bugs pile up unowned", ko: "버그가 주인 없이 쌓임" },
        body: {
          en: "Bugs pile up because no one owns which features actually ship.",
          ko: "어떤 기능이 실제로 나가는지 아무도 정하지 않아서 버그가 쌓여요.",
        },
        x: 0.16, y: 0.82,
      },
      {
        id: "cap_advisor",
        authorName: "Prof. Diaz",
        authorRole: { en: "Advisor", ko: "지도교수" },
        title: { en: "Pick a lane", ko: "한 방향을 골라라" },
        body: {
          en: "Every check-in I say the same thing: pick one user and one core flow.",
          ko: "매 점검 때 같은 말을 해요: 한 사용자와 하나의 핵심 흐름을 고르라고.",
        },
        x: 0.5, y: 0.86,
      },
      {
        id: "cap_team",
        authorName: "Mina",
        authorRole: { en: "Teammate", ko: "팀원" },
        title: { en: "Everyone builds a different app", ko: "각자 다른 앱을 만듦" },
        body: {
          en: "It feels like each of us is quietly building a slightly different app.",
          ko: "각자 조용히 조금씩 다른 앱을 만들고 있는 느낌이에요.",
        },
        x: 0.66, y: 0.82,
      },
    ],
    sampleBridges: [
      // FACET A: "no shared target" (research / demo / advisor / team fuse)
      {
        fragmentAId: "cap_research",
        fragmentBId: "cap_demo",
        relationType: "overlap",
        explanation: {
          en: "Not knowing who it's for and having no demo story are the same gap: no shared target.",
          ko: "대상 사용자를 모르는 것과 데모 스토리가 없는 것은 같은 공백이에요: 공유된 대상 없음.",
        },
        evidenceA: { en: "who the app is for", ko: "누구를 위한 앱인가" },
        evidenceB: { en: "what problem we're solving", ko: "무슨 문제를 푸는지" },
        confidence: 0.84,
      },
      {
        fragmentAId: "cap_team",
        fragmentBId: "cap_research",
        relationType: "overlap",
        explanation: {
          en: "Everyone building a different app is exactly what 'never agreed who it's for' looks like in practice.",
          ko: "각자 다른 앱을 만드는 건 '대상 미합의'가 실제로 드러난 모습이에요.",
        },
        evidenceA: { en: "different app", ko: "다른 앱" },
        evidenceB: { en: "haven't agreed who", ko: "누구인지 미합의" },
        confidence: 0.82,
      },
      {
        fragmentAId: "cap_advisor",
        fragmentBId: "cap_research",
        relationType: "complement",
        explanation: {
          en: "The advisor's 'pick one user and one flow' is the missing decision behind 'never agreed who it's for.'",
          ko: "지도교수의 '한 사용자·한 흐름을 골라라'는 '대상 미합의' 뒤에 빠진 결정 그 자체예요.",
        },
        evidenceA: { en: "pick one user and one core flow", ko: "한 사용자·한 핵심 흐름" },
        evidenceB: { en: "haven't agreed who", ko: "누구인지 미합의" },
        confidence: 0.8,
      },
      // FACET B: "scope thrash" (scope / dev / qa fuse)
      {
        fragmentAId: "cap_scope",
        fragmentBId: "cap_qa",
        relationType: "overlap",
        explanation: {
          en: "Too many unfinished features and unowned bugs are two faces of the same unscoped work.",
          ko: "완성 안 된 기능이 너무 많은 것과 주인 없는 버그는 범위 안 정해진 같은 일의 두 얼굴이에요.",
        },
        evidenceA: { en: "none feel finished", ko: "완성된 느낌이 아님" },
        evidenceB: { en: "no one owns which ship", ko: "무엇이 나갈지 주인 없음" },
        confidence: 0.78,
      },
      {
        fragmentAId: "cap_scope",
        fragmentBId: "cap_dev",
        relationType: "dependency",
        explanation: {
          en: "Too many unfinished features force constant plan changes, which is what causes the rewrites.",
          ko: "완성 안 된 기능이 너무 많아 계획이 계속 바뀌고, 그게 재작업의 원인이에요.",
        },
        evidenceA: { en: "none feel finished", ko: "완성된 느낌이 아님" },
        evidenceB: { en: "plan changes I rewrite", ko: "계획 바뀌면 재작성" },
        confidence: 0.82,
      },
      // SPINE: no shared target drives the scope thrash and the lost users
      {
        fragmentAId: "cap_research",
        fragmentBId: "cap_scope",
        relationType: "dependency",
        explanation: {
          en: "No agreed user is why the feature list keeps growing — no target means no cut line.",
          ko: "대상 미합의가 기능 목록이 계속 늘어나는 이유예요 — 대상이 없으면 자를 기준도 없죠.",
        },
        evidenceA: { en: "haven't agreed who", ko: "대상 미합의" },
        evidenceB: { en: "too many features", ko: "너무 많은 기능" },
        confidence: 0.85,
      },
      {
        fragmentAId: "cap_research",
        fragmentBId: "cap_design",
        relationType: "dependency",
        explanation: {
          en: "An undefined user makes an unclear main flow — that's why testers got lost.",
          ko: "대상이 불명확하면 핵심 흐름도 불명확해요 — 그래서 테스터가 헤맸죠.",
        },
        evidenceA: { en: "who the app is for", ko: "누구를 위한 앱인가" },
        evidenceB: { en: "couldn't figure out the main flow", ko: "핵심 흐름을 이해 못 함" },
        confidence: 0.8,
      },
      // TENSION: ship less vs the promises already made
      {
        fragmentAId: "cap_advisor",
        fragmentBId: "cap_scope",
        relationType: "tension",
        explanation: {
          en: "The advisor says cut to one flow, but the team already promised the long feature list — a real pull.",
          ko: "지도교수는 하나로 줄이라 하지만 팀은 이미 긴 기능 목록을 약속했어요 — 진짜 당김이에요.",
        },
        evidenceA: { en: "pick one core flow", ko: "하나의 핵심 흐름" },
        evidenceB: { en: "promised too many features", ko: "너무 많은 기능을 약속" },
        confidence: 0.76,
      },
    ],
    reveal: {
      name: { en: "No agreed user", ko: "합의 안 된 사용자" },
      note: {
        en: "Every symptom downstream traces to one decision nobody made.",
        ko: "모든 하류 증상이 아무도 안 내린 결정 하나로 거슬러 올라가요.",
      },
      readings: [
        {
          en: "It reads as a scope problem — too many half-features, endless rewrites, unowned bugs piling up.",
          ko: "범위 문제로 읽혀요 — 반쯤 된 기능이 너무 많고, 재작업이 끝없고, 주인 없는 버그가 쌓여요.",
        },
        {
          en: "It reads as a coordination problem — everyone is quietly building a slightly different app.",
          ko: "협업 문제로 읽혀요 — 다들 조용히 조금씩 다른 앱을 만들고 있어요.",
        },
        {
          en: "It reads as one upstream decision — you never agreed who it's for, so nothing downstream can settle.",
          ko: "하나의 상류 결정으로 읽혀요 — 대상을 못 정해서 그 아래 무엇도 정착을 못 해요.",
        },
      ],
      hypothesis: {
        en: "Maybe none of the visible problems are the problem: they're all symptoms of never agreeing who the app is for. If that's true, you'd expect the feature list, the lost users, and the rewrites to keep regenerating no matter how hard you grind — until you name one user and one flow, and then most of them dissolve at once.",
        ko: "어쩌면 눈에 보이는 문제들은 문제가 아니에요: 전부 '대상 미합의'의 증상이에요. 그게 맞다면, 아무리 갈아넣어도 기능 목록·헤매는 사용자·재작업이 계속 재생될 거예요 — 한 사용자와 한 흐름을 정하는 순간, 대부분이 한꺼번에 녹아 사라질 때까지.",
      },
      verdict: {
        en: "The core isn't features, time, or bugs — it's that you never chose a user. Everything you called a separate crisis is the downstream of that one skipped decision. Pick one user and one flow this week, and four of your five problems stop being problems.",
        ko: "핵심은 기능도, 시간도, 버그도 아니에요 — 사용자를 안 골랐다는 거예요. 당신이 별개의 위기라 부른 모든 게 그 건너뛴 결정 하나의 하류예요. 이번 주에 한 사용자와 한 흐름을 고르면, 다섯 문제 중 넷이 문제이길 멈춰요.",
      },
      question: {
        en: "So the real question is: if we had to name one user and one core flow by Friday and cut everything else, which would we choose — and what would that let us stop building?",
        ko: "그래서 진짜 질문은: 금요일까지 한 사용자와 하나의 핵심 흐름을 정하고 나머지를 다 잘라야 한다면 무엇을 고를 것인가 — 그러면 무엇을 그만 만들어도 되는가?",
      },
    },
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
        x: 0.2, y: 0.24,
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
        x: 0.8, y: 0.24,
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
        x: 0.18, y: 0.56,
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
        x: 0.5, y: 0.86,
      },
      {
        id: "park_dog",
        authorName: "Bea",
        authorRole: { en: "Dog owner", ko: "반려견 주민" },
        title: { en: "Dogs and kids clash", ko: "개와 아이가 뒤엉킴" },
        body: {
          en: "With no zones, off-leash dogs and toddlers end up in the same muddy patch.",
          ko: "구역이 없어서 목줄 푼 개와 아기들이 같은 진흙탕에 뒤엉켜요.",
        },
        x: 0.82, y: 0.56,
      },
      {
        id: "park_cyclist",
        authorName: "Otto",
        authorRole: { en: "Commuter", ko: "자전거 통근자" },
        title: { en: "No safe way through", ko: "가로지를 안전한 길 없음" },
        body: {
          en: "There's no safe way to cross the park, so I ride on the road with the cars.",
          ko: "공원을 안전하게 가로지를 길이 없어서 차도로 달려요.",
        },
        x: 0.5, y: 0.12,
      },
      {
        id: "park_gardener",
        authorName: "Yuki",
        authorRole: { en: "Volunteer gardener", ko: "자원봉사 정원사" },
        title: { en: "Drainage kills the lawn", ko: "배수 문제로 잔디가 죽음" },
        body: {
          en: "Water pools everywhere after rain and it's slowly killing the grass and beds.",
          ko: "비 오면 물이 곳곳에 고여서 잔디와 화단이 서서히 죽고 있어요.",
        },
        x: 0.34, y: 0.72,
      },
    ],
    sampleBridges: [
      // FACET A: "the ground can't handle water" (runner / gardener fuse; the physical layer)
      {
        fragmentAId: "park_runner",
        fragmentBId: "park_gardener",
        relationType: "overlap",
        explanation: {
          en: "Flooding paths and a dying lawn are the same root: the park can't drain rainwater.",
          ko: "물 고이는 길과 죽어가는 잔디는 같은 뿌리예요: 공원이 빗물을 못 빼요.",
        },
        evidenceA: { en: "flood whenever it rains", ko: "비만 오면 물이 고임" },
        evidenceB: { en: "water pools everywhere", ko: "물이 곳곳에 고임" },
        confidence: 0.82,
      },
      // FACET B: "no safe route / no zones for who uses it" (parent / cyclist / dog fuse)
      {
        fragmentAId: "park_parent",
        fragmentBId: "park_cyclist",
        relationType: "overlap",
        explanation: {
          en: "No safe place for kids and no safe way to cross are the same missing thing: a safe route through.",
          ko: "아이들의 안전한 곳 없음과 안전하게 가로지를 길 없음은 같은 것: 안전한 통로가 없어요.",
        },
        evidenceA: { en: "nowhere safe away from the road", ko: "도로에서 떨어진 안전한 곳 없음" },
        evidenceB: { en: "no safe way to cross", ko: "가로지를 안전한 길 없음" },
        confidence: 0.79,
      },
      {
        fragmentAId: "park_dog",
        fragmentBId: "park_parent",
        relationType: "complement",
        explanation: {
          en: "Dogs and toddlers clashing is the same 'no zoning' gap that leaves kids unsafe — it completes the picture.",
          ko: "개와 아기가 뒤엉키는 건 아이들을 위험하게 두는 '구역 없음'과 같은 공백이에요 — 그림을 완성해요.",
        },
        evidenceA: { en: "no zones", ko: "구역이 없음" },
        evidenceB: { en: "nowhere safe for kids", ko: "아이들이 놀 안전한 곳 없음" },
        confidence: 0.76,
      },
      // FACET C bridge: benches complete the "who can actually use it" side
      {
        fragmentAId: "park_senior",
        fragmentBId: "park_parent",
        relationType: "complement",
        explanation: {
          en: "Benches for elders and safe spots for kids are two halves of one thing: a park everyone can actually use.",
          ko: "어르신 벤치와 아이 안전 공간은 한 가지의 두 반쪽이에요: 모두가 실제로 쓸 수 있는 공원.",
        },
        evidenceA: { en: "older people can't rest", ko: "나이 든 사람이 못 쉼" },
        evidenceB: { en: "nowhere safe for kids", ko: "아이들이 안전하게 놀 곳 없음" },
        confidence: 0.74,
      },
      // SPINE: broken drainage drives the broken paths that block safe routes
      {
        fragmentAId: "park_gardener",
        fragmentBId: "park_runner",
        relationType: "dependency",
        explanation: {
          en: "The drainage problem is what cracks and floods the paths in the first place.",
          ko: "배수 문제가 애초에 길을 갈라지게 하고 물에 잠기게 해요.",
        },
        evidenceA: { en: "water pools everywhere", ko: "물이 곳곳에 고임" },
        evidenceB: { en: "cracked and flood", ko: "갈라지고 물 고임" },
        confidence: 0.78,
      },
      {
        fragmentAId: "park_runner",
        fragmentBId: "park_cyclist",
        relationType: "dependency",
        explanation: {
          en: "Broken, flooding paths are why there's no safe way to cross — the surface itself fails.",
          ko: "갈라지고 물 고이는 길 때문에 안전하게 가로지를 방법이 없어요 — 노면 자체가 문제죠.",
        },
        evidenceA: { en: "cracked and flood", ko: "갈라지고 물 고임" },
        evidenceB: { en: "no safe way to cross", ko: "가로지를 안전한 길 없음" },
        confidence: 0.75,
      },
      // TENSION: one budget vs many needs (kept alive)
      {
        fragmentAId: "park_budget",
        fragmentBId: "park_parent",
        relationType: "tension",
        explanation: {
          en: "'Pick one thing' collides with the safety need — naming it lets the group prioritize, not argue.",
          ko: "'하나만 고르자'는 안전 요구와 부딪혀요 — 그걸 드러내면 다투는 대신 우선순위를 정할 수 있어요.",
        },
        evidenceA: { en: "have to pick one thing", ko: "하나만 골라야 함" },
        evidenceB: { en: "nowhere safe for kids", ko: "아이들이 놀 안전한 곳 없음" },
        confidence: 0.8,
      },
    ],
    reveal: {
      name: { en: "The ground, not the amenities", ko: "시설이 아니라 땅바닥" },
      note: {
        en: "Benches, zones and safe routes all sit on one surface that can't drain.",
        ko: "벤치·구역·안전 통로가 전부 물 못 빼는 한 지면 위에 놓여 있어요.",
      },
      readings: [
        {
          en: "It's a competing-wishes story: parents, seniors, runners and dog owners each want a different amenity on one budget.",
          ko: "바람이 경쟁하는 이야기예요: 학부모·어르신·러너·견주가 하나의 예산으로 각기 다른 시설을 원해요.",
        },
        {
          en: "It's a zoning story: with no defined areas, kids, dogs and cyclists collide in the same space.",
          ko: "구역 나누기 이야기예요: 정해진 영역이 없어 아이·개·자전거가 같은 공간에서 부딪혀요.",
        },
        {
          en: "It's an infrastructure story: broken drainage rots the paths and lawn, and everything else is built on that.",
          ko: "인프라 이야기예요: 망가진 배수가 길과 잔디를 썩게 하고, 나머지는 전부 그 위에 지어져요.",
        },
      ],
      hypothesis: {
        en: "Maybe the neighbors aren't actually disagreeing — the 'redesign' fight is really about which amenity to buy, but every amenity is being undermined by the same failing drainage. If so, fixing the ground first would make one shared budget stretch further than any single amenity would.",
        ko: "어쩌면 이웃들은 사실 반대하는 게 아니에요 — '재설계' 다툼은 어떤 시설을 살까의 문제지만, 모든 시설이 같은 배수 문제로 무너지고 있어요. 그렇다면 땅부터 고치는 게 어떤 단일 시설보다 하나의 예산을 더 멀리 가게 해요.",
      },
      verdict: {
        en: "The core isn't which amenity to fund — it's that the ground can't drain. Broken paths, dying lawn, and unsafe routes are all downstream of one failing surface. Fix drainage first, and the 'pick one thing' fight mostly disappears.",
        ko: "핵심은 어떤 시설에 돈을 쓸까가 아니라 — 땅이 물을 못 뺀다는 거예요. 망가진 길·죽는 잔디·위험한 통로가 전부 무너지는 지면 하나의 하류예요. 배수부터 고치면 '하나만 고르자' 다툼은 대부분 사라져요.",
      },
      question: {
        en: "So the real question is: could one drainage-and-path fix be framed as the shared foundation everyone's amenity depends on — instead of forcing neighbors to compete for a single upgrade?",
        ko: "그래서 진짜 질문은: 배수·산책로 정비 하나를 모두의 시설이 기대는 공동 기반으로 제시할 수 있는가 — 이웃들을 단 하나의 업그레이드를 두고 경쟁시키는 대신?",
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "clinic",
    emoji: "🏥",
    title: {
      en: "Why do patients keep missing appointments?",
      ko: "환자들은 왜 자꾸 예약을 놓칠까?",
    },
    prompt: {
      en: "A community clinic reviews its no-show problem. Each team sees a different cause — and a different fix.",
      ko: "지역 병원이 예약 부도(노쇼) 문제를 점검합니다. 각 팀이 원인도, 해법도 다르게 봐요.",
    },
    fragments: [
      {
        id: "cli_front",
        authorName: "Grace",
        authorRole: { en: "Front desk", ko: "접수" },
        title: { en: "Reminders bounce", ko: "안내 문자가 안 닿음" },
        body: {
          en: "Half our reminder texts bounce because the phone numbers on file are old.",
          ko: "등록된 전화번호가 오래돼서 안내 문자 절반이 안 닿아요.",
        },
        x: 0.2, y: 0.24,
      },
      {
        id: "cli_nurse",
        authorName: "Dev",
        authorRole: { en: "Nurse", ko: "간호사" },
        title: { en: "Slots don't fit lives", ko: "시간대가 삶과 안 맞음" },
        body: {
          en: "We only offer weekday daytime slots, which working patients can't make.",
          ko: "평일 낮 시간대만 있어서 일하는 환자들은 못 와요.",
        },
        x: 0.8, y: 0.24,
      },
      {
        id: "cli_social",
        authorName: "Amara",
        authorRole: { en: "Social worker", ko: "사회복지사" },
        title: { en: "No way to get here", ko: "올 방법이 없음" },
        body: {
          en: "Many patients have no reliable transport and the bus doesn't run near us.",
          ko: "많은 환자가 마땅한 교통편이 없고 버스도 근처에 안 다녀요.",
        },
        x: 0.18, y: 0.56,
      },
      {
        id: "cli_admin",
        authorName: "Paul",
        authorRole: { en: "Admin", ko: "행정" },
        title: { en: "No-shows cost us", ko: "노쇼가 손실을 냄" },
        body: {
          en: "Every no-show is a wasted slot and lost funding we can't recover.",
          ko: "노쇼 하나하나가 낭비된 슬롯이자 회복 못 하는 손실 재원이에요.",
        },
        x: 0.5, y: 0.86,
      },
      {
        id: "cli_doctor",
        authorName: "Dr. Reyes",
        authorRole: { en: "Physician", ko: "의사" },
        title: { en: "Patients don't get why it matters", ko: "왜 중요한지 환자가 모름" },
        body: {
          en: "Patients skip follow-ups because no one explained why the visit matters.",
          ko: "이 방문이 왜 중요한지 아무도 설명 안 해줘서 환자들이 추적 진료를 건너뛰어요.",
        },
        x: 0.82, y: 0.56,
      },
      {
        id: "cli_intake",
        authorName: "Lin",
        authorRole: { en: "Intake", ko: "초진 접수" },
        title: { en: "Contact info goes stale", ko: "연락처가 낡아버림" },
        body: {
          en: "We only collect contact info once at signup and never update it.",
          ko: "가입 때 딱 한 번 연락처를 받고 이후로 갱신을 안 해요.",
        },
        x: 0.34, y: 0.72,
      },
      {
        id: "cli_patient",
        authorName: "Marta",
        authorRole: { en: "Patient advocate", ko: "환자 대변인" },
        title: { en: "Missing one visit spirals", ko: "한 번 놓치면 눈덩이" },
        body: {
          en: "When someone misses one visit, they fall behind and often stop coming entirely.",
          ko: "한 번 방문을 놓치면 뒤처지고, 결국 아예 안 오게 되는 경우가 많아요.",
        },
        x: 0.5, y: 0.12,
      },
    ],
    sampleBridges: [
      // FACET A: "we can't reach them" (front desk / intake fuse)
      {
        fragmentAId: "cli_front",
        fragmentBId: "cli_intake",
        relationType: "overlap",
        explanation: {
          en: "Bouncing reminders and never-updated contact info are the same problem seen twice.",
          ko: "안 닿는 안내 문자와 갱신 안 되는 연락처는 같은 문제의 두 모습이에요.",
        },
        evidenceA: { en: "phone numbers on file are old", ko: "등록 번호가 오래됨" },
        evidenceB: { en: "never update it", ko: "갱신을 안 함" },
        confidence: 0.85,
      },
      // FACET B: "they can't physically come" (nurse / social worker fuse)
      {
        fragmentAId: "cli_nurse",
        fragmentBId: "cli_social",
        relationType: "overlap",
        explanation: {
          en: "Wrong-time slots and no transport are two forms of the same barrier: they can't physically get here.",
          ko: "안 맞는 시간대와 교통편 없음은 같은 장벽의 두 형태예요: 물리적으로 못 와요.",
        },
        evidenceA: { en: "can't make weekday daytime", ko: "평일 낮에 못 옴" },
        evidenceB: { en: "no reliable transport", ko: "교통편이 없음" },
        confidence: 0.79,
      },
      // FACET C: "they don't see why" (doctor / patient advocate — motivation layer)
      {
        fragmentAId: "cli_doctor",
        fragmentBId: "cli_patient",
        relationType: "complement",
        explanation: {
          en: "Not understanding why it matters and one miss spiraling complete each other: no reason to fight back in.",
          ko: "왜 중요한지 모르는 것과 한 번 놓치면 눈덩이 되는 것은 서로를 보완해요: 다시 올 이유가 없죠.",
        },
        evidenceA: { en: "no one explained why", ko: "왜 중요한지 설명 안 함" },
        evidenceB: { en: "stop coming entirely", ko: "아예 안 오게 됨" },
        confidence: 0.77,
      },
      // SPINE: stale contact info drives bounced reminders drives no-shows drives cost
      {
        fragmentAId: "cli_intake",
        fragmentBId: "cli_front",
        relationType: "dependency",
        explanation: {
          en: "Collecting contact info only once is exactly why the reminder texts bounce.",
          ko: "연락처를 한 번만 받는 것이 안내 문자가 안 닿는 바로 그 이유예요.",
        },
        evidenceA: { en: "collect once, never update", ko: "한 번만 받고 갱신 안 함" },
        evidenceB: { en: "reminder texts bounce", ko: "안내 문자가 안 닿음" },
        confidence: 0.8,
      },
      {
        fragmentAId: "cli_front",
        fragmentBId: "cli_admin",
        relationType: "dependency",
        explanation: {
          en: "Reminders that never arrive lead straight to the no-shows that cost the clinic.",
          ko: "닿지 않는 안내는 곧바로 병원에 손실을 내는 노쇼로 이어져요.",
        },
        evidenceA: { en: "reminders bounce", ko: "안내가 안 닿음" },
        evidenceB: { en: "every no-show is lost funding", ko: "노쇼는 손실 재원" },
        confidence: 0.78,
      },
      {
        fragmentAId: "cli_social",
        fragmentBId: "cli_admin",
        relationType: "dependency",
        explanation: {
          en: "No way to get here turns directly into the wasted slots admin is worried about.",
          ko: "올 방법이 없는 것은 행정이 걱정하는 낭비된 슬롯으로 직결돼요.",
        },
        evidenceA: { en: "no reliable transport", ko: "교통편 없음" },
        evidenceB: { en: "wasted slot", ko: "낭비된 슬롯" },
        confidence: 0.74,
      },
      // TENSION: fixing reach vs the effort/cost it takes (kept alive)
      {
        fragmentAId: "cli_nurse",
        fragmentBId: "cli_admin",
        relationType: "tension",
        explanation: {
          en: "Adding evening/weekend slots would help patients but stretches an already thin, underfunded staff.",
          ko: "저녁·주말 시간대를 늘리면 환자엔 도움이 되지만 이미 빠듯한 인력·재원을 더 쥐어짜요.",
        },
        evidenceA: { en: "only weekday daytime slots", ko: "평일 낮 시간대만" },
        evidenceB: { en: "lost funding", ko: "손실 재원" },
        confidence: 0.72,
      },
    ],
    reveal: {
      name: { en: "Barriers, not no-shows", ko: "노쇼가 아니라 장벽" },
      note: {
        en: "Two separate walls — can't-reach and can't-come — feed the same lost slots.",
        ko: "'못 닿음'과 '못 옴'이라는 두 개의 벽이 같은 낭비된 슬롯을 만들어요.",
      },
      readings: [
        {
          en: "It's a data-hygiene story: contact info is collected once and never updated, so half the reminders never land.",
          ko: "데이터 위생 이야기예요: 연락처를 한 번만 받고 갱신을 안 해서 안내 절반이 안 닿아요.",
        },
        {
          en: "It's an access story: weekday-only slots and no transport mean many patients physically can't come.",
          ko: "접근성 이야기예요: 평일 낮만 있고 교통편이 없어 많은 환자가 물리적으로 못 와요.",
        },
        {
          en: "It's a motivation story: no one explained why the visit matters, so one miss quietly becomes never.",
          ko: "동기 이야기예요: 이 방문이 왜 중요한지 아무도 설명 안 해서, 한 번 놓침이 조용히 영영으로 이어져요.",
        },
      ],
      hypothesis: {
        en: "Maybe 'no-show' is the wrong word — patients aren't flaking, they're hitting walls the clinic built: unreachable, un-gettable-to, un-motivated. If so, you'd expect the cheapest fix (just updating phone numbers at every visit) to recover more slots than any new program, because the biggest wall is the one you can't even see them behind.",
        ko: "어쩌면 '노쇼'는 틀린 말이에요 — 환자가 무책임한 게 아니라, 병원이 세운 벽에 부딪히는 거예요: 못 닿고, 못 오고, 동기 없고. 그렇다면 가장 싼 해법(매 방문마다 전화번호만 갱신)이 어떤 새 프로그램보다 더 많은 슬롯을 되찾을 거예요 — 가장 큰 벽은 그들이 뒤에 있는지조차 안 보이는 벽이니까.",
      },
      verdict: {
        en: "The core isn't patient no-shows — it's three clinic-side barriers wearing one costume. Fix the cheapest one first: update contact info at every visit. You can't motivate or transport a patient you can't even reach.",
        ko: "핵심은 환자의 노쇼가 아니라 — 하나의 탈을 쓴 세 개의 병원 측 장벽이에요. 가장 싼 것부터 고치세요: 매 방문마다 연락처를 갱신. 닿지도 못하는 환자를 동기부여하거나 데려올 수는 없어요.",
      },
      question: {
        en: "So the real question is: before spending on new slots or transport, could we recover the most no-shows just by re-confirming contact info at every single visit?",
        ko: "그래서 진짜 질문은: 새 시간대나 교통편에 돈을 쓰기 전에, 매 방문마다 연락처를 다시 확인하는 것만으로 가장 많은 노쇼를 되찾을 수 있지 않을까?",
      },
    },
  },
];

export function getScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
