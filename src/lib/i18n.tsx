"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "ko";

// Every UI string in both languages. Keep keys stable; UI reads t("key").
const dict = {
  // ---- app shell ----
  "app.title": { en: "We All Touch the Same Elephant", ko: "We All Touch the Same Elephant" },
  "app.tagline": {
    en: "Everyone sees a part. Connect the pieces into one shared picture.",
    ko: "각자 한 부분만 봅니다. 조각을 이어 하나의 그림으로 맞춰보세요.",
  },
  "lang.toggle": { en: "한국어", ko: "English" },

  // ---- steps / nav ----
  "step.gather": { en: "1 · Add pieces", ko: "1 · 조각 넣기" },
  "step.connect": { en: "2 · Find links", ko: "2 · 연결 찾기" },
  "step.mirror": { en: "3 · See the whole", ko: "3 · 전체 보기" },

  // ---- landing / start ----
  "start.heading": { en: "What are we deciding together?", ko: "우리가 함께 정할 것은 무엇인가요?" },
  "start.sub": {
    en: "Many issues usually hide one real core. Everyone drops the part they see, the AI suggests how the pieces connect, and together you find the crux behind them all.",
    ko: "여러 문제 뒤엔 대개 하나의 진짜 핵심이 숨어 있어요. 각자 본 부분을 적으면 AI가 조각들이 어떻게 이어질지 제안하고, 그 모든 것의 핵심을 함께 찾습니다.",
  },
  "start.example": {
    en: "e.g. “App keeps slipping, too many features, users get lost, endless rewrites” → the crux might be: no shared user.",
    ko: "예: “앱이 자꾸 늦고, 기능은 많고, 사용자는 헤매고, 재작업만 반복” → 핵심은 어쩌면: 대상 사용자 미합의.",
  },
  "start.trySample": { en: "Try a ready-made example", ko: "미리 준비된 예시로 시작" },
  "start.orBlank": { en: "or start from a blank table", ko: "또는 빈 테이블에서 시작" },
  "start.blankBtn": { en: "Start blank", ko: "빈 테이블로 시작" },
  "start.samplePick": { en: "Pick a scenario", ko: "시나리오 선택" },

  // ---- fragment gathering ----
  "gather.heading": { en: "Add the pieces you each see", ko: "각자 본 조각을 더하세요" },
  "gather.hint": {
    en: "A piece is one short thought — a symptom, a concern, a dependency, or an expected consequence. One or two sentences. The more angles you add, the clearer the crux becomes.",
    ko: "조각은 하나의 짧은 생각이에요 — 증상, 우려, 의존 관계, 예상되는 결과 등. 한두 문장이면 됩니다. 다양한 각도를 더할수록 핵심이 또렷해져요.",
  },
  "gather.author": { en: "Your name", ko: "이름" },
  "gather.role": { en: "Role / team", ko: "역할 / 팀" },
  "gather.title": { en: "Short label", ko: "짧은 제목" },
  "gather.body": { en: "What you see (1–3 sentences)", ko: "당신이 본 것 (1~3문장)" },
  "gather.add": { en: "Add piece", ko: "조각 추가" },
  "gather.count": { en: "pieces on the table", ko: "개의 조각이 테이블에 있어요" },
  "gather.needMore": { en: "Add at least 3 pieces to begin connecting.", ko: "잇기를 시작하려면 최소 3개의 조각이 필요해요." },
  "gather.toConnect": { en: "Go connect the pieces", ko: "조각 잇기로 넘어가기" },
  "gather.empty": {
    en: "No pieces yet. Add the first one, or load a sample from the top.",
    ko: "아직 조각이 없어요. 첫 조각을 추가하거나 위에서 샘플을 불러오세요.",
  },
  "gather.remove": { en: "Remove", ko: "삭제" },

  // ---- connect / bridges ----
  "connect.heading": { en: "How might these connect?", ko: "이것들은 어떻게 이어질까요?" },
  "connect.hint": {
    en: "The AI suggests possible bridges between two pieces. It never decides for you — confirm, tweak, or dismiss each one.",
    ko: "AI가 두 조각 사이의 연결(다리)을 제안합니다. 대신 결정하지 않아요 — 각 제안을 확인하거나 수정하거나 지우세요.",
  },
  "connect.find": { en: "Suggest connections", ko: "연결 제안받기" },
  "connect.findMore": { en: "Suggest more", ko: "더 제안받기" },
  "connect.thinking": { en: "Looking for connections…", ko: "연결을 찾는 중…" },
  "connect.none": {
    en: "No strong connections found right now. Try adding or editing a piece.",
    ko: "지금은 뚜렷한 연결을 찾지 못했어요. 조각을 추가하거나 수정해 보세요.",
  },
  "connect.allDone": {
    en: "You've looked at every pair. Nice — head to the whole picture.",
    ko: "모든 조각 쌍을 살펴봤어요. 좋아요 — 전체 그림으로 넘어가세요.",
  },
  "connect.tray": { en: "Suggested bridges", ko: "제안된 다리" },
  "connect.trayEmpty": {
    en: "Press “Suggest connections” to see how the AI might bridge two pieces.",
    ko: "“연결 제안받기”를 누르면 AI가 두 조각을 어떻게 잇는지 볼 수 있어요.",
  },
  "bridge.confirm": { en: "Confirm", ko: "확인" },
  "bridge.edit": { en: "Edit", ko: "수정" },
  "bridge.reject": { en: "Dismiss", ko: "지우기" },
  "bridge.save": { en: "Save", ko: "저장" },
  "bridge.cancel": { en: "Cancel", ko: "취소" },
  "bridge.because": { en: "because", ko: "왜냐하면" },
  "bridge.evidenceA": { en: "From the first piece", ko: "첫 번째 조각에서" },
  "bridge.evidenceB": { en: "From the second piece", ko: "두 번째 조각에서" },
  "bridge.confirmedCount": { en: "connections confirmed", ko: "개의 연결 확인됨" },
  "bridge.addManual": { en: "Connect two yourself", ko: "직접 두 조각 잇기" },
  "manual.start": { en: "+ Draw your own connection", ko: "+ 내가 직접 연결 그리기" },
  "manual.pickFirst": { en: "Click the first piece on the table", ko: "테이블에서 첫 번째 조각을 클릭하세요" },
  "manual.pickSecond": { en: "Now click the second piece", ko: "이제 두 번째 조각을 클릭하세요" },
  "manual.chooseRelation": { en: "How do these relate?", ko: "이 둘은 어떤 관계인가요?" },
  "manual.note": { en: "Say why (optional)", ko: "이유를 적어보세요 (선택)" },
  "manual.create": { en: "Connect them", ko: "연결하기" },
  "manual.cancel": { en: "Cancel", ko: "취소" },
  "manual.yours": { en: "yours", ko: "직접" },

  // relation types
  "rel.overlap": { en: "Same issue, different angle", ko: "같은 문제, 다른 각도" },
  "rel.tension": { en: "Pulling in different directions", ko: "서로 다른 방향" },
  "rel.dependency": { en: "One affects the other", ko: "하나가 다른 것에 영향" },
  "rel.complement": { en: "One completes the other", ko: "하나가 다른 것을 보완" },
  "rel.overlap.short": { en: "Overlap", ko: "겹침" },
  "rel.tension.short": { en: "Tension", ko: "긴장" },
  "rel.dependency.short": { en: "Depends", ko: "의존" },
  "rel.complement.short": { en: "Completes", ko: "보완" },

  // ---- named assembly (the reveal) ----
  "assemble.cta": { en: "Gather into one", ko: "하나로 모으기" },
  "assemble.hint": {
    en: "You've connected enough pieces. Gather them and name the one thing they were all about.",
    ko: "충분히 이었어요. 조각들을 모아, 이것들이 사실 무엇이었는지 이름을 붙여보세요.",
  },
  "assemble.naming": { en: "Naming what you found…", ko: "찾은 것에 이름을 붙이는 중…" },
  "assemble.namePrompt": { en: "Name this elephant", ko: "이 코끼리에 이름을 붙이세요" },
  "assemble.namePlaceholder": { en: "e.g. Untraceable change ownership", ko: "예: 추적 안 되는 변경 소유권" },
  "assemble.aiSuggested": { en: "AI suggested", ko: "AI 제안" },
  "assemble.accept": { en: "That's it", ko: "이거예요" },
  "assemble.useName": { en: "Use this name", ko: "이 이름 쓰기" },
  "assemble.fromCount": { en: "fragments", ko: "개 조각" },
  "assemble.bridgesCount": { en: "confirmed connections", ko: "개 연결" },
  "assemble.namedBy": { en: "named by the team", ko: "팀이 붙인 이름" },
  "assemble.reveal": { en: "These weren't separate problems — they're one elephant.", ko: "이건 따로따로가 아니었어요 — 하나의 코끼리였어요." },
  "assemble.scatter": { en: "Spread back out", ko: "다시 펼치기" },
  "assemble.rename": { en: "Rename", ko: "이름 바꾸기" },
  "assemble.loose": {
    en: "still on its own — try connecting it too",
    ko: "아직 따로 있어요 — 이것도 이어보세요",
  },

  // ---- reveal modes (what kind of elephant the AI hands back) ----
  "reveal.pick": {
    en: "Your pieces are connected. How would you like to look at the whole?",
    ko: "조각이 모두 이어졌어요. 전체를 어떻게 보시겠어요?",
  },
  "reveal.explore": { en: "See a few angles", ko: "여러 각도로 보기" },
  "reveal.explore.sub": {
    en: "A few different ways to read the whole picture",
    ko: "전체 그림을 읽는 몇 가지 다른 방식",
  },
  "reveal.hypothesis": { en: "Point me at the likely core", ko: "핵심으로 보이는 곳 짚어주기" },
  "reveal.hypothesis.sub": {
    en: "One idea worth checking — what might really be underneath",
    ko: "확인해볼 만한 짚음 하나 — 밑에 진짜 뭐가 있을지",
  },
  "reveal.verdict": { en: "Name the core directly", ko: "핵심을 콕 짚어주기" },
  "reveal.verdict.sub": {
    en: "One clear take you can push back on",
    ko: "반박해볼 수 있는 분명한 한 마디",
  },
  "reveal.thinking": { en: "Reading the picture you built…", ko: "여러분이 만든 그림을 읽는 중…" },
  "reveal.readingsLabel": { en: "A few ways to read it", ko: "이렇게 읽어볼 수 있어요" },
  "reveal.hypothesisLabel": { en: "Worth a closer look", ko: "더 들여다볼 만한 것" },
  "reveal.verdictLabel": { en: "The likely core", ko: "핵심으로 보이는 것" },
  "reveal.verdictCaveat": {
    en: "A starting point to push back on — not the final word. Try another angle anytime.",
    ko: "반박해볼 출발점이에요 — 정답이 아니라. 언제든 다른 각도로 볼 수 있어요.",
  },

  // ---- synthesis (the assembled elephant) ----
  "synth.roots": { en: "Root pressures", ko: "근본 압력" },
  "synth.symptoms": { en: "Visible symptoms", ko: "드러난 증상" },
  "synth.keystone": { en: "The root the rest grow from", ko: "나머지가 자라난 뿌리" },
  "synth.noFlow": {
    en: "Tip: mark some links as “one affects the other” to reveal which side is the root and which are symptoms.",
    ko: "팁: 일부 연결을 “하나가 다른 것에 영향”으로 표시하면 무엇이 뿌리이고 무엇이 증상인지 드러나요.",
  },
  "synth.heading": { en: "The shape you assembled", ko: "여러분이 맞춘 모양" },
  "synth.oneSide": { en: "one side", ko: "한 면" },
  "synth.sides": { en: "sides of the same thing", ko: "개의 면이 한 몸이었어요" },
  "synth.facetLabel": { en: "Sides", ko: "면(側)" },
  "synth.tensionLabel": { en: "Live tensions", ko: "살아있는 긴장" },
  "synth.wholenessLabel": { en: "Assembled", ko: "조립도" },
  "synth.facetIntro": {
    en: "These pieces turned out to be facets of the same thing:",
    ko: "이 조각들은 사실 같은 것의 여러 면이었어요:",
  },
  "synth.tensionIntro": {
    en: "And these stay in real tension — kept, not resolved away:",
    ko: "그리고 이건 진짜 긴장으로 남아요 — 없애지 않고 그대로 둡니다:",
  },
  "synth.looseIntro": {
    en: "Still floating on its own — try connecting it too:",
    ko: "아직 혼자 떠 있어요 — 이것도 이어보세요:",
  },
  "synth.keystoneIntro": {
    en: "The root the rest seem to grow from — even if it's connected to few:",
    ko: "나머지가 자라난 듯한 뿌리 — 연결은 적더라도:",
  },
  "synth.facetOf": { en: "of", ko: "/" },
  "synth.pieceOne": { en: "piece", ko: "조각" },
  "synth.piecesMany": { en: "pieces", ko: "조각" },

  // ---- crux (final picture) ----
  "crux.viewAssembly": { en: "The ring", ko: "고리 보기" },
  "crux.viewFlow": { en: "The whole shape", ko: "전체 모양" },
  "crux.likely": { en: "Most connected — likely the crux?", ko: "가장 많이 연결됨 — 핵심일까요?" },
  "crux.setAsCrux": { en: "Make this the crux", ko: "이걸 핵심으로" },
  "crux.upstream": { en: "Root pressures", ko: "근본 원인" },
  "crux.downstream": { en: "Visible symptoms", ko: "드러난 증상" },
  "crux.realQuestion": { en: "So the real question is…", ko: "그래서 진짜 질문은…" },
  "crux.editQuestion": { en: "Edit the question", ko: "질문 수정" },
  "crux.stat": { en: "connections", ko: "개 연결" },
  "crux.drives": { en: "drives", ko: "→ 이끔" },
  "crux.noFlow": {
    en: "Tip: mark some connections as “one affects the other” (dependency) to see what drives what.",
    ko: "팁: 일부 연결을 “하나가 다른 것에 영향”(의존)으로 표시하면 무엇이 무엇을 이끄는지 보여요.",
  },

  // ---- mirror ----
  "mirror.heading": { en: "The one shape your pieces make", ko: "여러분의 조각이 이루는 하나의 그림" },
  "mirror.hint": {
    en: "Your connections fused the pieces into a few sides of the same thing. Here's the shape — which sides rest on which, and what stays in tension. A picture to argue with, not a verdict.",
    ko: "여러분의 연결이 조각들을 같은 것의 몇 개 면으로 묶었어요. 그 모양이에요 — 어느 면이 어디에 기대는지, 무엇이 긴장으로 남는지. 정답이 아니라 함께 따져볼 그림입니다.",
  },
  "mirror.locked": {
    en: "Confirm at least 3 connections to reveal the whole picture.",
    ko: "전체 그림을 보려면 최소 3개의 연결을 확인하세요.",
  },
  "mirror.reveal": { en: "Show the assembled shape", ko: "맞춰진 모양 보기" },
  "mirror.thinking": { en: "Reflecting the shape…", ko: "모양을 비추는 중…" },
  "mirror.connected": { en: "What came together", ko: "이어진 것" },
  "mirror.tensions": { en: "Open tensions", ko: "남은 긴장" },
  "mirror.separate": { en: "Still on their own", ko: "아직 따로인 것" },
  "mirror.draftLabel": { en: "Mirror draft — not a conclusion", ko: "미러 초안 — 결론이 아님" },
  "mirror.redo": { en: "Re-reflect", ko: "다시 비추기" },

  // ---- canvas / panel ----
  "panel.groups": { en: "Connected groups", ko: "연결된 묶음" },
  "panel.loose": { en: "Not yet connected", ko: "아직 연결 안 됨" },
  "panel.tensions": { en: "Open tensions", ko: "열린 긴장" },
  "panel.bridges": { en: "Confirmed bridges", ko: "확인된 다리" },
  "canvas.empty": { en: "Your pieces will appear here.", ko: "조각들이 여기에 나타납니다." },
  "canvas.hintConnect": {
    en: "Confirmed connections draw a line between pieces.",
    ko: "확인된 연결은 조각 사이에 선으로 그려집니다.",
  },

  // ---- misc ----
  "common.by": { en: "by", ko: "—" },
  "common.reset": { en: "Reset table", ko: "테이블 초기화" },
  "common.back": { en: "Back", ko: "뒤로" },
  "common.next": { en: "Next", ko: "다음" },
  "common.sampleMode": { en: "Sample mode", ko: "샘플 모드" },
  "common.sampleModeHint": {
    en: "No API key set — connections come from the pre-baked scenario.",
    ko: "API 키가 없어 — 연결은 미리 준비된 시나리오에서 나옵니다.",
  },
  "common.liveMode": { en: "Live AI", ko: "실시간 AI" },

  // ---- onboarding tour ----
  "tour.skip": { en: "Skip", ko: "건너뛰기" },
  "tour.next": { en: "Got it", ko: "알겠어요" },
  "tour.done": { en: "Start", ko: "시작하기" },
  "tour.1.title": { en: "Everyone sees a part", ko: "각자 한 부분을 봅니다" },
  "tour.1.body": {
    en: "Like blind men touching an elephant, each teammate holds a fragment of the whole. First, gather those fragments.",
    ko: "코끼리를 만지는 장님들처럼, 팀원마다 전체의 한 조각을 쥐고 있어요. 먼저 그 조각들을 모읍니다.",
  },
  "tour.2.title": { en: "The AI proposes connections", ko: "AI가 연결을 제안합니다" },
  "tour.2.body": {
    en: "It won't summarize or decide. It only suggests how two pieces might relate. You confirm, edit, or dismiss.",
    ko: "요약하거나 결정하지 않아요. 두 조각이 어떻게 이어질지 제안만 합니다. 확인·수정·삭제는 여러분 몫이에요.",
  },
  "tour.3.title": { en: "You assemble the elephant", ko: "코끼리는 여러분이 맞춥니다" },
  "tour.3.body": {
    en: "As you confirm bridges, the scattered pieces form one shape. Only then does the AI mirror back what you built.",
    ko: "다리를 확인할수록 흩어진 조각이 하나의 모양이 됩니다. 그 다음에야 AI가 여러분이 만든 것을 되비춰줍니다.",
  },
} as const;

export type TKey = keyof typeof dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" &&
      window.localStorage.getItem("watse-lang")) as Lang | null;
    if (saved === "en" || saved === "ko") setLangState(saved);
    else if (typeof navigator !== "undefined" && navigator.language.startsWith("ko"))
      setLangState("ko");
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("watse-lang", l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (k: TKey) => dict[k]?.[lang] ?? k;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
