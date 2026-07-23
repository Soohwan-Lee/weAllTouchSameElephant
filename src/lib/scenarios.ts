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
          en: "Priority is the story: an unglamorous audit trail keeps losing the roadmap, so revenue quietly bleeds.",
          ko: "우선순위 문제로 보여요: 화려하지 않은 감사 추적이 계속 로드맵에서 밀려서 매출이 조용히 새요.",
        },
        {
          en: "Or it's really about trust — without a tamper-proof record, buyers and renewals don't believe your change history.",
          ko: "아니면 결국 신뢰 문제예요 — 위변조 방지 기록이 없으니 구매자도 갱신 고객도 변경 이력을 안 믿어요.",
        },
        {
          en: "Read another way it's an architecture bet: the feature that unlocks deals is the one Engineering says will slow the core.",
          ko: "다르게 보면 아키텍처 내기예요: 계약을 여는 바로 그 기능이 엔지니어링이 코어를 느리게 한다고 말하는 그거예요.",
        },
      ],
      hypothesis: {
        en: "The tamper-proof change log is the hidden root — not security. Nobody ever owned it on the roadmap, so if that's the cause, every 'stuck deal' should trace back to the same missing artifact, and shipping it once would clear Sales, Legal, Support and renewals together.",
        ko: "위변조 방지 변경 로그가 숨은 뿌리예요 — 보안이 아니라. 로드맵에서 아무도 책임진 적이 없죠. 그게 원인이라면 모든 '막힌 계약'이 같은 빠진 기능으로 수렴하고, 그걸 한 번 출시하면 영업·법무·지원·갱신이 한꺼번에 풀릴 거예요.",
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
          en: "On the surface it's scope — too many half-features, endless rewrites, unowned bugs piling up.",
          ko: "겉으로는 범위 문제예요 — 반쯤 된 기능이 너무 많고, 재작업이 끝없고, 주인 없는 버그가 쌓여요.",
        },
        {
          en: "Look closer and it's coordination — everyone is quietly building a slightly different app.",
          ko: "가까이 보면 협업 문제예요 — 다들 조용히 조금씩 다른 앱을 만들고 있어요.",
        },
        {
          en: "Underneath sits one upstream decision — you never agreed who it's for, so nothing downstream can settle.",
          ko: "그 아래엔 상류 결정 하나가 있어요 — 대상을 못 정해서 그 아래 무엇도 정착을 못 해요.",
        },
      ],
      hypothesis: {
        en: "None of the visible problems is the problem — they're all symptoms of never agreeing who the app is for. If that's the cause, the feature list, lost users, and rewrites keep regenerating no matter how hard you grind, until you name one user and one flow — then most dissolve at once.",
        ko: "눈에 보이는 문제들은 문제가 아니에요 — 전부 '대상 미합의'의 증상이죠. 그게 원인이라면 아무리 갈아넣어도 기능 목록·헤매는 사용자·재작업이 계속 재생돼요. 한 사용자와 한 흐름을 정하는 순간, 대부분이 한꺼번에 녹아 사라질 거예요.",
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
          en: "Competing wishes are one lens: parents, seniors, runners and dog owners each want a different amenity on one budget.",
          ko: "하나는 바람이 경쟁하는 렌즈예요: 학부모·어르신·러너·견주가 하나의 예산으로 각기 다른 시설을 원해요.",
        },
        {
          en: "Or it's about zoning — with no defined areas, kids, dogs and cyclists collide in the same space.",
          ko: "아니면 구역 문제예요 — 정해진 영역이 없어 아이·개·자전거가 같은 공간에서 부딪혀요.",
        },
        {
          en: "Deeper down it's infrastructure: broken drainage rots the paths and lawn, and everything else is built on that.",
          ko: "더 깊이 보면 인프라예요: 망가진 배수가 길과 잔디를 썩게 하고, 나머지는 전부 그 위에 지어져요.",
        },
      ],
      hypothesis: {
        en: "The neighbors aren't really disagreeing — the 'redesign' fight is about which amenity to buy, while the same failing drainage undermines every one of them. If that's the cause, fixing the ground first makes one shared budget stretch further than any single amenity would.",
        ko: "이웃들은 사실 반대하는 게 아니에요 — '재설계' 다툼은 어떤 시설을 살까의 문제이고, 같은 배수 문제가 그 시설들을 전부 무너뜨리고 있죠. 그게 원인이라면, 땅부터 고치는 게 어떤 단일 시설보다 하나의 예산을 더 멀리 가게 해요.",
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
  // AI ADOPTION FACTIONS — everyone wants the company to adopt AI; they split
  // hard on HOW. Same elephant, opposed grips: start-now vs prove-ROI-first,
  // all-at-once vs a few power users, buy vs build. The point here is NOT a
  // hidden root to uncover but genuine tensions to KEEP — the scenario is built
  // so `tension` and `separate` carry it, and merging everything would be the
  // mistake. (The "blind men arguing" meme, made literal.)
  {
    id: "factions",
    emoji: "⚔️",
    title: {
      en: "How should we adopt AI — and who decides?",
      ko: "AI를 어떻게 도입할까 — 그리고 누가 정하나?",
    },
    prompt: {
      en: "Everyone agrees the company should use AI. Nobody agrees on how. The room has split into camps that each think the others are being reckless — or timid. Are they fighting over the same elephant?",
      ko: "AI를 써야 한다는 데는 모두 동의해요. 그런데 '어떻게'에서 완전히 갈렸어요. 서로를 무모하다고, 혹은 겁쟁이라고 여기는 진영으로 나뉘었죠. 이들은 같은 코끼리를 두고 싸우는 걸까요?",
    },
    fragments: [
      {
        id: "fac_now",
        authorName: "Tae",
        authorRole: { en: "Head of Product", ko: "프로덕트 총괄" },
        title: { en: "Just start — learn by doing", ko: "일단 시작 — 하면서 배우자" },
        body: {
          en: "We'll never learn AI from a spreadsheet. Roll it out now, everywhere, and fix what breaks. Waiting is the real risk.",
          ko: "AI는 스프레드시트로 못 배워요. 지금 전사에 깔고 깨지는 걸 고치면 돼요. 기다리는 게 진짜 리스크예요.",
        },
        x: 0.18, y: 0.2,
      },
      {
        id: "fac_roi",
        authorName: "Min",
        authorRole: { en: "CFO", ko: "재무총괄" },
        title: { en: "Prove the ROI first", ko: "ROI부터 증명하자" },
        body: {
          en: "I won't sign a company-wide license on vibes. Show me one team where it pays for itself, then we scale.",
          ko: "분위기로 전사 라이선스에 사인 못 해요. 한 팀에서 본전을 뽑는 걸 보여주면, 그때 확장하죠.",
        },
        x: 0.5, y: 0.16,
      },
      {
        id: "fac_pilot",
        authorName: "Jae",
        authorRole: { en: "Eng Lead", ko: "엔지니어 리드" },
        title: { en: "Power users first, then spread", ko: "잘 쓰는 사람부터, 그다음 확산" },
        body: {
          en: "Give it to the ten people already hungry for it. They'll build the playbook everyone else copies. A big-bang rollout just floods support.",
          ko: "이미 간절한 열 명한테 먼저 줘요. 그들이 나머지가 따라 할 플레이북을 만들어요. 일괄 도입은 고객지원만 터뜨려요.",
        },
        x: 0.82, y: 0.24,
      },
      {
        id: "fac_all",
        authorName: "Sun",
        authorRole: { en: "COO", ko: "운영총괄" },
        title: { en: "All at once or not at all", ko: "일괄 아니면 관두자" },
        body: {
          en: "Phased rollouts create two classes of worker and a year of 'why do they get it and I don't.' If we commit, everyone gets it the same week.",
          ko: "순차 도입은 두 계급의 직원과 '왜 쟤만 주냐'는 1년을 만들어요. 할 거면 같은 주에 다 같이 받아야죠.",
        },
        x: 0.2, y: 0.6,
      },
      {
        id: "fac_build",
        authorName: "Rae",
        authorRole: { en: "Data Lead", ko: "데이터 리드" },
        title: { en: "Buy leaks our data", ko: "사면 데이터가 샌다" },
        body: {
          en: "Every off-the-shelf tool ships our internal data to someone's cloud. If AI touches customer records, we build in-house or we don't do it.",
          ko: "기성 도구는 전부 우리 내부 데이터를 남의 클라우드로 보내요. AI가 고객 기록을 만진다면, 자체 구축하거나 안 하는 거예요.",
        },
        x: 0.54, y: 0.66,
      },
      {
        id: "fac_people",
        authorName: "Bo",
        authorRole: { en: "Head of People", ko: "인사총괄" },
        title: { en: "Nobody said whose job changes", ko: "누구 일이 바뀌는지 아무도 안 말함" },
        body: {
          en: "Whatever we pick, my team fields the fear. 'Efficiency' with no word on roles reads as layoffs, and the best people leave first.",
          ko: "뭘 고르든 두려움은 제 팀이 받아요. 역할 얘기 없는 '효율화'는 정리해고로 읽히고, 유능한 사람이 먼저 떠나요.",
        },
        x: 0.83, y: 0.62,
      },
    ],
    // Built so the board is mostly TENSIONS and one SEPARATE — the shape a real
    // faction fight makes. Only one genuine overlap (the two rollout-speed camps
    // share the same underlying worry about support load).
    sampleBridges: [
      {
        // the headline axis: move-now vs prove-first pull opposite ways
        fragmentAId: "fac_now",
        fragmentBId: "fac_roi",
        relationType: "tension",
        explanation: {
          en: "Start-now and prove-ROI-first are a real trade-off: you cannot both learn by shipping widely AND gate on proof from a single team.",
          ko: "지금-시작과 ROI-먼저는 진짜 트레이드오프예요: 널리 배포해 배우면서 동시에 한 팀의 증명으로 문을 잠글 순 없어요.",
        },
        evidenceA: { en: "Roll it out now, everywhere", ko: "지금 전사에 깔고" },
        evidenceB: { en: "one team where it pays for itself", ko: "한 팀에서 본전을 뽑는" },
        confidence: 0.9,
      },
      {
        // the rollout-shape axis: all-at-once vs power-users-first
        fragmentAId: "fac_all",
        fragmentBId: "fac_pilot",
        relationType: "tension",
        explanation: {
          en: "Same-week-for-everyone and start-with-ten-power-users are directly opposed rollout shapes — one fairness, one learning.",
          ko: "같은-주-전원과 열-명-먼저는 정반대의 도입 방식이에요 — 하나는 공정성, 하나는 학습.",
        },
        evidenceA: { en: "everyone gets it the same week", ko: "같은 주에 다 같이" },
        evidenceB: { en: "Give it to the ten people", ko: "열 명한테 먼저" },
        confidence: 0.88,
      },
      {
        // the two "spread it" camps actually share one fear → the one real overlap
        fragmentAId: "fac_pilot",
        fragmentBId: "fac_people",
        relationType: "complement",
        explanation: {
          en: "The playbook the power users write is exactly what People needs to answer 'whose job changes' — the how-to and the fear are two halves of one rollout.",
          ko: "파워유저가 쓰는 플레이북이 인사가 '누구 일이 바뀌나'에 답할 재료예요 — 방법과 두려움은 한 도입의 양면이죠.",
        },
        evidenceA: { en: "playbook everyone else copies", ko: "나머지가 따라 할 플레이북" },
        evidenceB: { en: "whose job changes", ko: "누구 일이 바뀌는지" },
        confidence: 0.72,
      },
      {
        // build-vs-buy sits UNDER the speed fight: data constraint gates every plan
        fragmentAId: "fac_build",
        fragmentBId: "fac_now",
        relationType: "dependency",
        explanation: {
          en: "The data constraint drives the timeline: if anything touching customer records must be built in-house, 'just start everywhere now' isn't available yet.",
          ko: "데이터 제약이 일정을 좌우해요: 고객 기록을 만지는 건 자체 구축이어야 한다면, '지금 전사 시작'은 아직 선택지가 아니에요.",
        },
        evidenceA: { en: "we build in-house or we don't", ko: "자체 구축하거나 안 하는" },
        evidenceB: { en: "now, everywhere", ko: "지금, 전사에" },
        confidence: 0.8,
      },
      {
        // the one thing to KEEP SEPARATE: the jobs question is not a rollout tactic
        fragmentAId: "fac_people",
        fragmentBId: "fac_roi",
        relationType: "separate",
        explanation: {
          en: "Whose-job-changes is not the same question as does-it-pay. Folding the people impact into the ROI case is how the fear gets quietly priced out — keep them apart.",
          ko: "누구-일이-바뀌나는 본전이-되나와 같은 질문이 아니에요. 사람 영향을 ROI 계산에 접어 넣는 순간 두려움이 조용히 지워져요 — 따로 두세요.",
        },
        evidenceA: { en: "reads as layoffs", ko: "정리해고로 읽히고" },
        evidenceB: { en: "pays for itself", ko: "본전을 뽑는" },
        confidence: 0.83,
      },
    ],
    reveal: {
      name: { en: "One goal, four fault lines", ko: "하나의 목표, 네 개의 단층선" },
      note: {
        en: "Everyone wants AI adopted; the fight is over speed, shape, sourcing, and whose job changes — and most of it should stay a live disagreement, not be merged away.",
        ko: "모두 AI 도입을 원해요; 싸움은 속도·방식·조달·누구의 일이 바뀌나를 두고 벌어지고, 대부분은 합쳐 없앨 게 아니라 살아있는 이견으로 남아야 해요.",
      },
      readings: [
        {
          en: "Read as tempo, it's start-now vs prove-first — and the data-in-house constraint quietly settles it: you can't start everywhere until sourcing is decided.",
          ko: "속도로 읽으면 지금-시작 vs 증명-먼저인데, 데이터-자체구축 제약이 조용히 결론을 내요: 조달을 정하기 전엔 전사 시작이 불가능해요.",
        },
        {
          en: "Read as fairness, it's all-at-once vs power-users-first — one protects against a two-class workforce, the other against flooding support.",
          ko: "공정성으로 읽으면 일괄 vs 파워유저-먼저 — 하나는 두 계급 방지, 하나는 지원 폭주 방지예요.",
        },
        {
          en: "Read as trust, the loudest fights (speed, tooling) may be proxies for the unsaid one: nobody has said whose job changes, so every plan reads as a threat.",
          ko: "신뢰로 읽으면, 시끄러운 싸움(속도·도구)은 말 안 한 것의 대리전일 수 있어요: 누구 일이 바뀌는지 아무도 안 말해서 모든 계획이 위협으로 읽혀요.",
        },
      ],
      hypothesis: {
        en: "The tactical fights are downstream of two undecided constraints — data sourcing (which gates the timeline) and the jobs question (which is being kept out of the room). Settle those two and the speed/shape camps have something concrete to converge on; leave them unsaid and the factions keep proxy-fighting forever.",
        ko: "전술 싸움은 정해지지 않은 두 제약의 하류예요 — 데이터 조달(일정을 좌우)과 일자리 질문(방에서 배제됨). 이 둘을 정하면 속도·방식 진영이 수렴할 구체가 생기고, 안 정하면 진영들이 영원히 대리전을 벌여요.",
      },
      verdict: {
        en: "This isn't one hidden root — it's a genuine multi-axis disagreement, and treating it as a puzzle to 'solve' would flatten real trade-offs. The move is to name which tensions to KEEP (speed, rollout shape) and which two questions to actually decide (data sourcing, jobs), not to merge everyone into false agreement.",
        ko: "이건 숨은 뿌리 하나가 아니에요 — 진짜 다축 이견이고, '풀 퍼즐'로 다루면 진짜 트레이드오프를 뭉갭니다. 할 일은 어떤 긴장을 남길지(속도·방식)와 실제로 정할 두 질문(데이터 조달·일자리)을 가려내는 것이지, 모두를 거짓 합의로 병합하는 게 아니에요.",
      },
      question: {
        en: "Which of these disagreements do we need to resolve to move — and which are we better off keeping alive?",
        ko: "이 이견들 중 움직이려면 꼭 풀어야 할 건 무엇이고, 살려두는 편이 나은 건 무엇인가요?",
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // AI ADOPTION — six stakeholders whose *values* diverge (efficiency vs
  // survival vs trust vs risk), not just their symptoms. The hidden root is
  // not "which tool" but that nobody ever decided WHAT the AI is FOR.
  {
    id: "aiadopt",
    emoji: "🤖",
    title: {
      en: "Should we roll out AI across the company?",
      ko: "회사 전체에 AI를 도입해야 할까?",
    },
    prompt: {
      en: "Leadership wants an AI rollout decided this month. Each function is arguing from a different value — cost, jobs, risk, quality — and they're talking past each other.",
      ko: "경영진이 이번 달 안에 AI 도입을 결정하려 합니다. 부서마다 다른 가치(비용·일자리·리스크·품질)로 주장하며 서로 엇갈리고 있어요.",
    },
    fragments: [
      {
        id: "ai_exec",
        authorName: "Dana",
        authorRole: { en: "Leadership", ko: "경영진" },
        title: { en: "We're behind on cost", ko: "비용 경쟁에서 밀림" },
        body: {
          en: "Competitors are cutting costs with AI. If we don't automate the repetitive work this year, our margins fall behind.",
          ko: "경쟁사는 AI로 비용을 줄이고 있어요. 올해 반복 업무를 자동화하지 않으면 마진이 뒤처집니다.",
        },
        x: 0.20, y: 0.22,
      },
      {
        id: "ai_ic",
        authorName: "Marcus",
        authorRole: { en: "Frontline staff", ko: "실무자" },
        title: { en: "Is this replacing us?", ko: "우릴 대체하는 건가" },
        body: {
          en: "Nobody told us what happens to our jobs. People are quietly polishing résumés instead of learning the tool.",
          ko: "우리 일자리가 어떻게 되는지 아무도 말 안 해줬어요. 다들 도구를 배우는 대신 조용히 이력서를 손보고 있어요.",
        },
        x: 0.72, y: 0.24,
      },
      {
        id: "ai_legal",
        authorName: "Priya",
        authorRole: { en: "Legal", ko: "법무" },
        title: { en: "Who owns a bad output?", ko: "잘못된 출력은 누구 책임" },
        body: {
          en: "If the model gives a customer wrong advice, liability is unclear. I can't sign off without an accountability line.",
          ko: "모델이 고객에게 잘못된 조언을 하면 책임 소재가 불분명해요. 책임 라인 없이는 승인 못 합니다.",
        },
        x: 0.15, y: 0.55,
      },
      {
        id: "ai_cs",
        authorName: "Rosa",
        authorRole: { en: "Customer support", ko: "고객지원" },
        title: { en: "Quality could slip", ko: "품질이 떨어질 수도" },
        body: {
          en: "Customers can tell when an answer is canned. If the AI sounds off, trust erodes and the tickets come back angrier.",
          ko: "고객은 기계적인 답을 알아채요. AI가 어색하면 신뢰가 무너지고 문의가 더 화나서 돌아옵니다.",
        },
        x: 0.80, y: 0.56,
      },
      {
        id: "ai_data",
        authorName: "Kenji",
        authorRole: { en: "Data team", ko: "데이터팀" },
        title: { en: "Our data isn't ready", ko: "우리 데이터가 준비 안 됨" },
        body: {
          en: "The models are only as good as our messy, siloed data. Half the 'AI wins' people imagine won't survive contact with it.",
          ko: "모델은 우리의 지저분하고 분산된 데이터만큼만 좋아요. 사람들이 상상하는 'AI 성과'의 절반은 실제 데이터에 닿으면 무너집니다.",
        },
        x: 0.30, y: 0.80,
      },
      {
        id: "ai_hr",
        authorName: "Ellen",
        authorRole: { en: "HR / People", ko: "인사" },
        title: { en: "No retraining plan", ko: "재교육 계획 없음" },
        body: {
          en: "We keep saying 'people will move to higher-value work,' but there's no budget or plan to actually retrain anyone.",
          ko: "'사람들은 더 가치 있는 일로 옮겨갈 것'이라 말하지만, 실제로 누굴 재교육할 예산도 계획도 없어요.",
        },
        x: 0.66, y: 0.82,
      },
    ],
    sampleBridges: [
      // FACET: "we never said what AI is FOR" surfaces as trust/quality/jobs anxiety
      {
        fragmentAId: "ai_ic",
        fragmentBId: "ai_hr",
        relationType: "overlap",
        explanation: {
          en: "'Is this replacing us' and 'no retraining plan' are the same unanswered question: what happens to people.",
          ko: "'우릴 대체하나'와 '재교육 계획 없음'은 같은 미답의 질문이에요: 사람은 어떻게 되는가.",
        },
        evidenceA: { en: "what happens to our jobs", ko: "우리 일자리가 어떻게" },
        evidenceB: { en: "no plan to retrain anyone", ko: "재교육할 계획 없음" },
        confidence: 0.83,
      },
      {
        fragmentAId: "ai_cs",
        fragmentBId: "ai_legal",
        relationType: "complement",
        explanation: {
          en: "Support's 'quality could slip' and Legal's 'who owns a bad output' are two faces of one gap: nobody owns what the AI is accountable for.",
          ko: "고객지원의 '품질 하락'과 법무의 '잘못된 출력 책임'은 한 공백의 두 얼굴이에요: AI가 무엇에 책임지는지 아무도 안 정함.",
        },
        evidenceA: { en: "trust erodes", ko: "신뢰가 무너짐" },
        evidenceB: { en: "liability is unclear", ko: "책임 소재 불분명" },
        confidence: 0.76,
      },
      // SPINE: the cost push, run through an undefined purpose, produces the fear + risk
      {
        fragmentAId: "ai_exec",
        fragmentBId: "ai_ic",
        relationType: "dependency",
        explanation: {
          en: "The cost-cutting framing, never paired with a jobs answer, is exactly what reads to staff as 'replacing us.'",
          ko: "일자리에 대한 답 없이 나온 비용 절감 프레임이, 직원에게 '우릴 대체한다'로 읽히는 바로 그 원인이에요.",
        },
        evidenceA: { en: "automate the repetitive work", ko: "반복 업무 자동화" },
        evidenceB: { en: "replacing us", ko: "우릴 대체" },
        confidence: 0.8,
      },
      {
        fragmentAId: "ai_exec",
        fragmentBId: "ai_data",
        relationType: "dependency",
        explanation: {
          en: "The promised cost savings depend on data quality the data team says isn't there yet.",
          ko: "약속된 비용 절감은 데이터팀이 아직 없다고 말하는 데이터 품질에 달려 있어요.",
        },
        evidenceA: { en: "margins fall behind", ko: "마진이 뒤처짐" },
        evidenceB: { en: "won't survive contact with it", ko: "실제 데이터에 닿으면 무너짐" },
        confidence: 0.78,
      },
      {
        fragmentAId: "ai_legal",
        fragmentBId: "ai_cs",
        relationType: "dependency",
        explanation: {
          en: "Without a clear accountability line, a slip in quality has no owner — so support absorbs the angry tickets.",
          ko: "명확한 책임 라인이 없으면 품질 하락에 주인이 없고, 그래서 고객지원이 화난 문의를 떠안아요.",
        },
        evidenceA: { en: "can't sign off", ko: "승인 못 함" },
        evidenceB: { en: "tickets come back angrier", ko: "문의가 더 화나서 돌아옴" },
        confidence: 0.74,
      },
      {
        fragmentAId: "ai_exec",
        fragmentBId: "ai_legal",
        relationType: "dependency",
        explanation: {
          en: "Pushing to automate this year without naming who owns the AI's outputs is exactly what leaves Legal unable to sign off.",
          ko: "AI 출력의 책임자를 정하지 않은 채 올해 자동화를 밀어붙이는 것이, 법무가 승인 못 하게 만드는 바로 그 원인이에요.",
        },
        evidenceA: { en: "automate the repetitive work", ko: "반복 업무 자동화" },
        evidenceB: { en: "can't sign off without an accountability line", ko: "책임 라인 없이 승인 못 함" },
        confidence: 0.76,
      },
      // TENSION: speed vs readiness — kept alive, not resolved
      {
        fragmentAId: "ai_exec",
        fragmentBId: "ai_data",
        relationType: "tension",
        explanation: {
          en: "Leadership wants to move this year; the data team says the ground truth to move on isn't ready. Both can be right.",
          ko: "경영진은 올해 움직이려 하고, 데이터팀은 움직일 근거가 준비 안 됐다고 해요. 둘 다 맞을 수 있어요.",
        },
        evidenceA: { en: "this year", ko: "올해" },
        evidenceB: { en: "isn't ready", ko: "준비 안 됨" },
        confidence: 0.8,
      },
    ],
    reveal: {
      name: { en: "AI without a purpose decided", ko: "목적을 안 정한 AI" },
      note: {
        en: "Six functions argued the how before anyone decided what the AI is for.",
        ko: "여섯 부서가 '무엇을 위한 AI인가'를 정하기도 전에 '어떻게'를 다투고 있었어요.",
      },
      readings: [
        {
          en: "It looks like a jobs story: a cost-cutting message with no jobs answer, so the best people prepare to leave before the tool even lands.",
          ko: "일자리 이야기로 보여요: 일자리에 대한 답 없는 비용 절감 메시지라, 도구가 오기도 전에 유능한 사람들이 떠날 준비를 해요.",
        },
        {
          en: "Read as risk, it's an ownership gap: no accountability line means quality and liability quietly fall on whoever's nearest — usually support.",
          ko: "리스크로 읽으면 소유권 공백이에요: 책임 라인이 없으니 품질과 법적 책임이 가장 가까운 사람, 대개 고객지원에게 조용히 떨어져요.",
        },
        {
          en: "Or it's a readiness bet: the savings leadership is counting on ride on data the data team says will crumble on contact.",
          ko: "아니면 준비도 내기예요: 경영진이 기대는 절감이, 데이터팀이 닿으면 무너진다고 말하는 데이터 위에 서 있어요.",
        },
      ],
      hypothesis: {
        en: "The unmade decision is not which AI tool but what AI is FOR here — a governed risk or a shaped tool. If that's the root, then every function's objection is really the same missing answer wearing a different hat: name the purpose (and the jobs, ownership, and readiness that follow from it) once, and cost, trust, and risk stop being separate fights.",
        ko: "안 내린 결정은 '어떤 AI 도구냐'가 아니라 '여기서 AI가 무엇을 위한 것이냐'예요 — 통제할 리스크인가, 다듬을 도구인가. 그게 뿌리라면 각 부서의 반대는 사실 다른 탈을 쓴 같은 빈 답이에요: 목적(그리고 거기서 따라오는 일자리·책임·준비도)을 한 번 정하면 비용·신뢰·리스크가 따로 싸울 일이 아니게 됩니다.",
      },
      verdict: {
        en: "The core isn't the tool or the timeline — it's that leadership framed AI as a cost move without ever deciding what it's for or who owns its outcomes. Every downstream fear (jobs, liability, quality, bad data) is the cost of that one skipped decision. Pick the purpose first; the tool choice is downstream of it.",
        ko: "핵심은 도구도 일정도 아니라 — 경영진이 AI가 무엇을 위한 것인지, 그 결과를 누가 책임지는지 정하지 않은 채 '비용 수단'으로 프레임한 거예요. 아래의 모든 두려움(일자리·책임·품질·나쁜 데이터)이 그 건너뛴 결정 하나의 대가고요. 목적을 먼저 정하세요; 도구 선택은 그 다음이에요.",
      },
      question: {
        en: "So the real question is: before choosing any tool, can we state in one sentence what AI is for here — and what that commits us to for people, ownership, and data?",
        ko: "그래서 진짜 질문은: 어떤 도구를 고르기 전에, 여기서 AI가 무엇을 위한 것인지 한 문장으로 말할 수 있나 — 그리고 그것이 사람·책임·데이터에 대해 우리에게 무엇을 약속하게 하나?",
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // REDEVELOPMENT / SHELTER — the hardest divergence: stakeholders argue on
  // incommensurable value axes (safety vs dignity vs revenue vs votes vs need
  // vs profit). The hidden root is a legitimacy question no process owns:
  // who counts as belonging to this neighborhood.
  {
    id: "shelter",
    emoji: "🏙️",
    title: {
      en: "What goes on the empty downtown lot?",
      ko: "도심 빈 부지에 무엇을 지을까?",
    },
    prompt: {
      en: "The city must decide the fate of a vacant lot — a proposed homeless shelter, or redevelopment. Six stakeholders each argue from a value the others don't share.",
      ko: "시(市)가 빈 부지의 운명을 정해야 합니다 — 노숙인 쉼터냐, 재개발이냐. 여섯 이해관계자가 서로 공유하지 않는 가치로 각자 주장해요.",
    },
    fragments: [
      {
        id: "sh_resident",
        authorName: "Grace",
        authorRole: { en: "Resident", ko: "주민" },
        title: { en: "Will my street be safe?", ko: "우리 동네 안전할까" },
        body: {
          en: "I'm not against helping people, but I worry about safety for my kids and what a shelter does to our home's value.",
          ko: "사람 돕는 걸 반대하진 않아요. 다만 아이들 안전과 집값에 쉼터가 미칠 영향이 걱정돼요.",
        },
        x: 0.18, y: 0.20,
      },
      {
        id: "sh_advocate",
        authorName: "Malik",
        authorRole: { en: "Homeless advocate", ko: "노숙인 활동가" },
        title: { en: "People are dying outside", ko: "밖에서 사람이 죽어간다" },
        body: {
          en: "This is a dignity and survival issue. Every month without shelter, someone we know doesn't make it through the cold.",
          ko: "이건 존엄과 생존의 문제예요. 쉼터 없는 매달, 우리가 아는 누군가가 추위를 못 넘겨요.",
        },
        x: 0.74, y: 0.22,
      },
      {
        id: "sh_merchant",
        authorName: "Tomas",
        authorRole: { en: "Local business", ko: "지역 상인" },
        title: { en: "Foot traffic keeps us alive", ko: "유동인구가 우릴 살림" },
        body: {
          en: "My shop runs on people walking by. I've watched a shelter empty out a block before — I can't survive that here.",
          ko: "제 가게는 지나가는 사람으로 굴러가요. 쉼터가 한 블록을 비게 만드는 걸 봤어요 — 여기서 그걸 못 견뎌요.",
        },
        x: 0.16, y: 0.54,
      },
      {
        id: "sh_council",
        authorName: "Alderman Reyes",
        authorRole: { en: "City council", ko: "시의원" },
        title: { en: "Whatever I pick, I lose voters", ko: "뭘 골라도 표를 잃음" },
        body: {
          en: "Half my constituents want compassion, half want property values. Any decision costs me the other half at election.",
          ko: "제 지역구 절반은 온정을, 절반은 집값을 원해요. 어떤 결정을 해도 선거에서 나머지 절반을 잃어요.",
        },
        x: 0.82, y: 0.55,
      },
      {
        id: "sh_social",
        authorName: "Nadia",
        authorRole: { en: "Social worker", ko: "사회복지사" },
        title: { en: "A shelter alone won't fix it", ko: "쉼터만으론 안 됨" },
        body: {
          en: "Beds without services just move the problem indoors. Real need is treatment and case work, not just a roof.",
          ko: "서비스 없는 침대는 문제를 실내로 옮길 뿐이에요. 진짜 필요한 건 지붕만이 아니라 치료와 사례 관리예요.",
        },
        x: 0.32, y: 0.80,
      },
      {
        id: "sh_developer",
        authorName: "Quinn",
        authorRole: { en: "Developer", ko: "개발업체" },
        title: { en: "Housing pencils, shelter doesn't", ko: "주택은 수익, 쉼터는 손해" },
        body: {
          en: "Mixed-use housing on this lot funds itself and adds tax base. A shelter is a permanent cost the city has to carry.",
          ko: "이 부지의 복합 주택은 자체 수익이 나고 세수도 늘려요. 쉼터는 시가 계속 떠안아야 하는 영구 비용이고요.",
        },
        x: 0.68, y: 0.82,
      },
    ],
    sampleBridges: [
      // FACET: safety-fear and business-fear are the same fear of "who this lot brings"
      {
        fragmentAId: "sh_resident",
        fragmentBId: "sh_merchant",
        relationType: "overlap",
        explanation: {
          en: "The resident's safety worry and the merchant's foot-traffic worry are the same fear in two vocabularies: who this place brings, and whether they belong.",
          ko: "주민의 안전 걱정과 상인의 유동인구 걱정은 두 언어로 된 같은 두려움이에요: 이곳이 누구를 부르는가, 그리고 그들이 여기 속하는가.",
        },
        evidenceA: { en: "safety for my kids", ko: "아이들 안전" },
        evidenceB: { en: "empty out a block", ko: "블록을 비게 함" },
        confidence: 0.75,
      },
      {
        fragmentAId: "sh_advocate",
        fragmentBId: "sh_social",
        relationType: "complement",
        explanation: {
          en: "The advocate's 'people are dying' and the social worker's 'a shelter alone won't fix it' complete each other: the urgency and the reason a bed alone falls short.",
          ko: "활동가의 '사람이 죽어간다'와 복지사의 '쉼터만으론 안 됨'은 서로를 보완해요: 절박함과, 침대만으론 부족한 이유.",
        },
        evidenceA: { en: "someone doesn't make it", ko: "누군가 못 넘김" },
        evidenceB: { en: "move the problem indoors", ko: "문제를 실내로 옮김" },
        confidence: 0.72,
      },
      // SPINE: the unowned legitimacy question drives the councilmember's trap
      {
        fragmentAId: "sh_resident",
        fragmentBId: "sh_council",
        relationType: "dependency",
        explanation: {
          en: "The residents' unspoken 'do these people belong here' is exactly what splits the councilmember's base in two.",
          ko: "주민들의 말 못 한 '이 사람들이 여기 속하나'가 시의원의 지지 기반을 둘로 가르는 바로 그 지점이에요.",
        },
        evidenceA: { en: "what a shelter does to our home", ko: "쉼터가 집에 미치는 영향" },
        evidenceB: { en: "lose the other half", ko: "나머지 절반을 잃음" },
        confidence: 0.73,
      },
      {
        fragmentAId: "sh_developer",
        fragmentBId: "sh_council",
        relationType: "dependency",
        explanation: {
          en: "The developer's 'shelter is a permanent cost' hands the councilmember the fiscal argument that makes saying no feel responsible.",
          ko: "개발업체의 '쉼터는 영구 비용'이, 거절을 책임감 있어 보이게 만드는 재정 논리를 시의원에게 쥐여줘요.",
        },
        evidenceA: { en: "permanent cost", ko: "영구 비용" },
        evidenceB: { en: "any decision costs me", ko: "어떤 결정도 대가가 큼" },
        confidence: 0.7,
      },
      {
        fragmentAId: "sh_social",
        fragmentBId: "sh_developer",
        relationType: "dependency",
        explanation: {
          en: "Because services (not just beds) are what actually help, the 'shelter = pure cost' math is only true if the city keeps refusing to fund the services.",
          ko: "실제로 돕는 건 침대가 아니라 서비스이기 때문에, '쉼터 = 순수 비용' 계산은 시가 서비스 예산을 계속 거부할 때만 참이에요.",
        },
        evidenceA: { en: "treatment and case work", ko: "치료와 사례 관리" },
        evidenceB: { en: "cost the city has to carry", ko: "시가 떠안는 비용" },
        confidence: 0.68,
      },
      // TENSION: dignity vs revenue — genuinely incommensurable, kept alive
      {
        fragmentAId: "sh_advocate",
        fragmentBId: "sh_developer",
        relationType: "tension",
        explanation: {
          en: "One measures the lot in lives saved, the other in tax base added. These value scales don't convert — and pretending they do is how the fight stalls.",
          ko: "한쪽은 부지를 구한 생명으로, 다른 쪽은 늘어난 세수로 재요. 이 가치 척도는 서로 환산되지 않아요 — 되는 척하는 게 싸움이 멈추는 이유고요.",
        },
        evidenceA: { en: "dignity and survival", ko: "존엄과 생존" },
        evidenceB: { en: "funds itself, adds tax base", ko: "자체 수익, 세수 증가" },
        confidence: 0.82,
      },
    ],
    reveal: {
      name: { en: "Who counts as from here", ko: "누가 '여기 사람'인가" },
      note: {
        en: "Six people argued lot use on six value scales — but under them sits one unasked question of belonging.",
        ko: "여섯 사람이 여섯 가치 척도로 부지 용도를 다퉜지만, 그 아래엔 묻지 않은 '소속'의 질문 하나가 있어요.",
      },
      readings: [
        {
          en: "It looks like a safety-vs-compassion fight, but 'safe for my kids' and 'people are dying outside' are answers to different questions that never actually meet.",
          ko: "안전 대 온정의 싸움처럼 보이지만, '아이들에게 안전'과 '밖에서 사람이 죽어간다'는 서로 만난 적 없는 다른 질문에 대한 답이에요.",
        },
        {
          en: "Read fiscally, the whole thing turns on a choice the city hides: a shelter is 'pure cost' only because it keeps refusing to fund the services that would make it work.",
          ko: "재정으로 읽으면, 전체가 시가 숨기는 선택 하나에 달려 있어요: 쉼터가 '순수 비용'인 건 그것이 작동하게 할 서비스 예산을 계속 거부하기 때문일 뿐이에요.",
        },
        {
          en: "Underneath, it's a legitimacy question no process owns: does someone sleeping outside count as a resident of this neighborhood, with a claim on its land?",
          ko: "그 밑엔 어떤 절차도 책임지지 않는 정당성의 질문이 있어요: 밖에서 자는 사람이 이 동네의 주민으로, 이 땅에 대한 권리를 가진 사람으로 셈해지는가?",
        },
      ],
      hypothesis: {
        en: "The stuck point isn't the lot — it's an unowned question of belonging: who counts as 'from here.' If that's the root, then safety, foot traffic, votes, and cost are all proxies people reach for because the belonging question is too raw to say out loud. Name it, and the fight becomes about services and design (solvable) instead of worth (not).",
        ko: "막힌 지점은 부지가 아니라 — 누구도 책임지지 않는 소속의 질문이에요: 누가 '여기 사람'인가. 그게 뿌리라면 안전·유동인구·표·비용은 모두 사람들이 대신 붙드는 대용물이에요, 소속의 질문이 입 밖에 내기엔 너무 날것이라서요. 그걸 이름 붙이면, 싸움은 (풀 수 없는) 가치 문제 대신 (풀 수 있는) 서비스와 설계의 문제가 됩니다.",
      },
      verdict: {
        en: "The core isn't shelter-vs-housing — it's that no one will say out loud who this neighborhood is for. Every value on the table (safety, revenue, votes, dignity) is a stand-in for one unspoken judgment about who belongs. Until the belonging question is named, every 'practical' argument is really that judgment in disguise, and no design will settle it.",
        ko: "핵심은 쉼터냐 주택이냐가 아니라 — 이 동네가 누구를 위한 곳인지 아무도 소리 내어 말하지 않는다는 거예요. 테이블 위 모든 가치(안전·수익·표·존엄)가 '누가 속하는가'라는 말 못 한 판단의 대역이에요. 소속의 질문에 이름 붙이기 전엔, 모든 '현실적' 논거가 사실 그 판단의 위장이고, 어떤 설계로도 정리되지 않아요.",
      },
      question: {
        en: "So the real question is: before we design anything for this lot, can we say plainly who we think this neighborhood is for — and let that, not the land, be what we're actually deciding?",
        ko: "그래서 진짜 질문은: 이 부지에 무엇을 설계하기 전에, 우리가 이 동네를 누구를 위한 곳으로 여기는지 솔직히 말할 수 있나 — 그리고 땅이 아니라 그것을 우리가 실제로 정하는 대상으로 삼을 수 있나?",
      },
    },
  },
];

export function getScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
