"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "./store";

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
  "start.resumeHint": {
    en: "You have a session in progress — {f} pieces, {b} connections.",
    ko: "진행 중인 세션이 있어요 — 조각 {f}개, 연결 {b}개.",
  },
  "start.resume": { en: "Back to my session", ko: "내 세션으로 돌아가기" },
  "start.resumeWarn": {
    en: "Opening an example or a blank table below will replace it.",
    ko: "아래에서 예시나 빈 테이블을 열면 지금 세션이 사라져요.",
  },
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
  "gather.removeWarn": {
    en: "This piece has {n} confirmed connection(s). Removing it deletes them too. Continue?",
    ko: "이 조각에는 확정된 연결이 {n}개 있어요. 삭제하면 그 연결도 함께 사라집니다. 계속할까요?",
  },
  "gather.needMoreN": {
    en: "{n} of 3 — add {r} more to begin connecting",
    ko: "3개 중 {n}개 — 잇기를 시작하려면 {r}개 더",
  },

  // ---- input scaffolding (kill the blank-card bottleneck) ----
  "ptype.symptom": { en: "A symptom", ko: "증상" },
  "ptype.worry": { en: "A worry", ko: "우려" },
  "ptype.dependency": { en: "A dependency", ko: "의존 관계" },
  "ptype.outcome": { en: "An outcome", ko: "예상 결과" },
  "scaffold.typeHeading": { en: "What kind of piece is this?", ko: "이건 어떤 종류의 조각인가요?" },
  "scaffold.typeHint": {
    en: "Pick a kind and we'll hand you a starter to fill in — in your own words.",
    ko: "종류를 고르면 채워 넣을 시작 문장을 드려요 — 당신의 말로 바꾸세요.",
  },
  "scaffold.lensLabel": { en: "Answer from your seat", ko: "당신의 자리에서 답하기" },
  "scaffold.promptLabel": { en: "A question to spark it", ko: "떠올릴 실마리 질문" },
  "scaffold.useFrame": { en: "Use this starter", ko: "이 시작 문장 쓰기" },
  "scaffold.shuffle": { en: "Another question", ko: "다른 질문" },
  "scaffold.yourWords": {
    en: "This is only a starter — replace the ___ blanks with what you actually see.",
    ko: "이건 시작 문장일 뿐이에요 — ___ 빈칸을 당신이 실제로 본 것으로 바꾸세요.",
  },
  "scaffold.blankStuck": { en: "Not sure what to write?", ko: "뭘 써야 할지 모르겠나요?" },
  "scaffold.openHelp": { en: "Stuck? Get a starter", ko: "막막해요? 시작 문장 받기" },
  "scaffold.closeHelp": { en: "Hide the starters", ko: "시작 문장 닫기" },

  // ---- export ----
  "export.button": { en: "Export session", ko: "세션 내보내기" },
  "export.hint": {
    en: "Download everything — pieces, connections, who did what, and the decision — as a JSON file.",
    ko: "조각·연결·누가 무엇을 했는지·결정까지 전부 JSON 파일로 내려받아요.",
  },

  // ---- participants ----
  "people.heading": { en: "Who's at the table?", ko: "테이블에 누가 있나요?" },
  "people.hint": {
    en: "Add each person and their role. Pick who's adding pieces right now — it stamps their name on what they contribute.",
    ko: "각자 이름과 역할을 더하세요. 지금 조각을 올리는 사람을 고르면, 그 사람 이름이 기여에 새겨져요.",
  },
  "people.add": { en: "Add person", ko: "사람 추가" },
  "people.namePlaceholder": { en: "Name", ko: "이름" },
  "people.rolePlaceholder": { en: "Role / seat", ko: "역할 / 자리" },
  "people.adding": { en: "Adding as", ko: "지금 추가하는 사람" },
  "people.empty": {
    en: "No one added yet — or skip and add pieces anonymously.",
    ko: "아직 아무도 없어요 — 건너뛰고 익명으로 조각을 더해도 돼요.",
  },
  "people.remove": { en: "Remove", ko: "빼기" },
  "people.switch": { en: "Switch", ko: "바꾸기" },
  "people.switchHint": {
    en: "Whose piece is this? Pick the person entering it.",
    ko: "이건 누구의 조각인가요? 지금 입력하는 사람을 고르세요.",
  },
  "people.anon": { en: "Anonymous", ko: "익명" },
  "gather.addedFromConnect": { en: "Added. Want to fill another gap, or head back?", ko: "추가됐어요. 다른 빈 곳을 더 채울까요, 아니면 돌아갈까요?" },
  "gather.addAnother": { en: "Add another piece", ko: "조각 하나 더" },
  "gather.backToConnect": { en: "Back to connecting", ko: "연결로 돌아가기" },

  // ---- gather: decision anchor + entry modes ----
  "decision.label": { en: "What are we deciding?", ko: "우리가 정하려는 건?" },
  "decision.placeholder": {
    en: "e.g. Should we redesign the neighborhood park?",
    ko: "예: 동네 공원을 다시 설계해야 할까?",
  },
  "decision.hint": {
    en: "One question the team is trying to answer. Your pieces are the views you each hold on it.",
    ko: "팀이 답하려는 하나의 질문. 조각은 각자 그것에 대해 가진 관점이에요.",
  },
  "entry.heading": { en: "How do you want to add your pieces?", ko: "조각을 어떻게 더할까요?" },
  "entry.write": { en: "Write directly", ko: "직접 쓰기" },
  "entry.writeSub": { en: "I know what I want to say", ko: "무엇을 쓸지 알아요" },
  "entry.seeds": { en: "Get suggestions", ko: "제안 받기" },
  "entry.seedsSub": { en: "Show me angles I can pick from", ko: "고를 각도를 보여줘요" },
  "entry.talk": { en: "Talk it through", ko: "대화로 풀기" },
  "entry.talkSub": { en: "Help me figure out what I see", ko: "뭘 보는지 같이 찾아줘요" },
  "entry.comingSoon": { en: "Coming up next", ko: "곧 추가돼요" },
  "seeds.intro": {
    en: "Angles you might be seeing. Pick one that fits — then say it in your own words.",
    ko: "당신이 보고 있을 법한 각도들이에요. 맞는 걸 고른 뒤, 당신의 말로 바꿔 쓰세요.",
  },
  "seeds.get": { en: "Show me angles", ko: "각도 보여줘" },
  "seeds.regen": { en: "Other angles", ko: "다른 각도" },
  "seeds.loading": { en: "Finding angles…", ko: "각도를 찾는 중…" },
  "seeds.pick": { en: "Use this angle", ko: "이 각도 쓰기" },
  "seeds.picked": {
    en: "Now write what YOU see from this angle — the angle is just a doorway.",
    ko: "이제 이 각도에서 당신이 본 것을 쓰세요 — 각도는 문일 뿐이에요.",
  },
  "talk.intro": {
    en: "Not sure what you see? Answer a couple of questions in your own words — we'll turn your answer into draft cards you can edit.",
    ko: "뭘 보는지 모르겠나요? 몇 가지 질문에 당신의 말로 답해보세요 — 답을 편집 가능한 초안 카드로 바꿔드려요.",
  },
  "talk.start": { en: "Ask me questions", ko: "질문 받기" },
  "talk.loadingQ": { en: "Thinking of questions…", ko: "질문을 고르는 중…" },
  "talk.answerLabel": { en: "Your answer (your own words)", ko: "당신의 답 (당신의 말로)" },
  "talk.answerPlaceholder": {
    en: "Write freely — a few sentences about what you notice.",
    ko: "자유롭게 — 당신이 알아챈 것을 몇 문장으로.",
  },
  "talk.extract": { en: "Turn into cards", ko: "카드로 만들기" },
  "talk.extracting": { en: "Reading your answer…", ko: "답을 읽는 중…" },
  "talk.draftsHeading": { en: "Draft cards from your answer — edit, then add", ko: "당신의 답에서 뽑은 초안 — 고친 뒤 추가" },
  "talk.addDraft": { en: "Add to table", ko: "테이블에 추가" },
  "talk.noDrafts": {
    en: "Couldn't find a clear perspective yet — try saying a bit more.",
    ko: "아직 뚜렷한 관점을 찾지 못했어요 — 조금 더 말해보세요.",
  },
  "talk.restart": { en: "Start over", ko: "다시 시작" },

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
  "bridge.onBoard": { en: "On the board", ko: "지금 보드 위의 연결" },
  "bridge.unconfirm": { en: "Take back", ko: "되돌리기" },
  "bridge.unconfirmHint": {
    en: "Remove this connection from the board",
    ko: "이 연결을 보드에서 빼기",
  },
  "bridge.dismissedCount": {
    en: "{n} pair(s) dismissed — the AI won't suggest them again.",
    ko: "{n}개의 짝을 치웠어요 — AI가 다시 제안하지 않아요.",
  },
  "bridge.undoAllRejections": { en: "Allow them again", ko: "다시 허용하기" },
  "bridge.addManual": { en: "Connect two yourself", ko: "직접 두 조각 잇기" },
  "manual.start": { en: "+ Draw your own connection", ko: "+ 내가 직접 연결 그리기" },
  "manual.pickFirst": { en: "Click the first piece on the table", ko: "테이블에서 첫 번째 조각을 클릭하세요" },
  "manual.pickSecond": { en: "Now click the second piece", ko: "이제 두 번째 조각을 클릭하세요" },
  "manual.chooseRelation": { en: "How do these relate?", ko: "이 둘은 어떤 관계인가요?" },
  "manual.note": { en: "Say why (optional)", ko: "이유를 적어보세요 (선택)" },
  "manual.create": { en: "Connect them", ko: "연결하기" },
  "manual.cancel": { en: "Cancel", ko: "취소" },
  "manual.yours": { en: "yours", ko: "직접" },

  // ---- redundancy nudge (minimal edges) ----
  "nudge.redundant": {
    en: "These two already connect through the pieces between them.",
    ko: "이 둘은 사이의 조각들을 통해 이미 이어져 있어요.",
  },
  "nudge.redundantAsk": {
    en: "Is this a genuinely new relation, or the same link said another way?",
    ko: "정말 새로운 관계인가요, 아니면 같은 연결을 다르게 말한 건가요?",
  },
  "nudge.linkAnyway": { en: "Add it anyway", ko: "그래도 연결" },
  "budget.enough": {
    en: "Enough links to hold every piece in one shape.",
    ko: "모든 조각을 한 그림으로 묶기에 충분한 연결이에요.",
  },
  "budget.extra": {
    en: "extra links beyond the minimum — each one is another claim, not more glue.",
    ko: "개의 연결이 최소보다 많아요 — 하나하나가 접착제가 아니라 또 하나의 주장이에요.",
  },
  "budget.need": {
    en: "more link(s) will hold the connected pieces in one shape.",
    ko: "개 더 이으면 연결된 조각들이 한 그림으로 묶여요.",
  },

  // ---- group-progress guide (fixes "3 links but no elephant") ----
  "group.label": { en: "Biggest connected group", ko: "가장 큰 연결 묶음" },
  "group.piecesShort": { en: "pieces", ko: "조각" },
  "group.needMore": {
    en: "Link {n} more piece(s) INTO this group to assemble the elephant — scattered links across separate pairs won't form one.",
    ko: "코끼리를 맞추려면 이 묶음에 조각 {n}개를 더 이어야 해요 — 따로 떨어진 쌍끼리의 연결로는 하나가 안 돼요.",
  },
  "group.ready": {
    en: "This group is big enough to assemble. Add more to make it richer, or head to the whole picture.",
    ko: "이 묶음은 조립하기에 충분해요. 더 이으면 풍부해지고, 아니면 전체 그림으로 넘어가세요.",
  },
  "mirror.lockedGroup": {
    en: "Link 3 pieces into ONE connected group to reveal the whole — not just 3 links.",
    ko: "전체를 보려면 조각 3개를 하나의 묶음으로 이어야 해요 — 선 3개가 아니라.",
  },

  // relation types
  "rel.overlap": { en: "Same issue, different angle", ko: "같은 문제, 다른 각도" },
  "rel.tension": { en: "Pulling in different directions", ko: "서로 다른 방향" },
  "rel.dependency": { en: "One affects the other", ko: "하나가 다른 것에 영향" },
  "rel.complement": { en: "One completes the other", ko: "하나가 다른 것을 보완" },
  "rel.separate": { en: "Must stay separate", ko: "따로 두어야 함" },
  "rel.overlap.short": { en: "Overlap", ko: "겹침" },
  "rel.tension.short": { en: "Tension", ko: "긴장" },
  "rel.dependency.short": { en: "Depends", ko: "의존" },
  "rel.complement.short": { en: "Completes", ko: "보완" },
  "rel.separate.short": { en: "Keep apart", ko: "따로" },
  "rel.separate.hint": {
    en: "Say why these two must NOT be merged — that boundary is a finding, not a failure.",
    ko: "이 둘을 왜 합치면 안 되는지 적어주세요 — 그 경계도 실패가 아니라 발견이에요.",
  },

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
  "reveal.explore": { en: "Hold it open", ko: "열어두고 보기" },
  "reveal.explore.sub": {
    en: "A few competing ways to read the picture — don't commit yet",
    ko: "서로 경쟁하는 몇 가지 읽기 — 아직 하나로 정하지 않기",
  },
  "reveal.hypothesis": { en: "Point me at the likely core", ko: "핵심으로 보이는 곳 짚어주기" },
  "reveal.hypothesis.sub": {
    en: "One idea worth checking — what might really be underneath",
    ko: "확인해볼 만한 짚음 하나 — 밑에 진짜 뭐가 있을지",
  },
  "reveal.verdict": { en: "Commit to one core", ko: "핵심 하나로 콕 짚기" },
  "reveal.verdict.sub": {
    en: "The single sharpest claim — one you can push back on",
    ko: "가장 날카로운 한 마디 — 반박해볼 수 있는",
  },
  "reveal.thinking": { en: "Reading the picture you built…", ko: "여러분이 만든 그림을 읽는 중…" },
  "reveal.readingsLabel": { en: "A few ways to read it", ko: "이렇게 읽어볼 수 있어요" },
  "reveal.angleLabel": { en: "Angle", ko: "관점" },
  "reveal.hypothesisLabel": { en: "Worth a closer look", ko: "더 들여다볼 만한 것" },
  "reveal.verdictLabel": { en: "The likely core", ko: "핵심으로 보이는 것" },
  "reveal.verdictCaveat": {
    en: "A starting point to push back on — not the final word. Try another angle anytime.",
    ko: "반박해볼 출발점이에요 — 정답이 아니라. 언제든 다른 각도로 볼 수 있어요.",
  },

  // ---- story spine (narrative-first reading of the assembled elephant) ----
  "story.heading": { en: "How your pieces fit together", ko: "여러분의 조각이 맞물리는 방식" },
  "story.sub": {
    en: "Read left to right: the root pressure on the left drives the symptoms on the right. Tap any side to see its pieces and why they connect.",
    ko: "왼쪽에서 오른쪽으로 읽으세요: 왼쪽의 근본 압력이 오른쪽의 증상들을 이끕니다. 어느 면이든 눌러 조각과 연결 이유를 보세요.",
  },
  "story.rootBadge": { en: "the root", ko: "뿌리" },
  "story.symptomBadge": { en: "symptom", ko: "증상" },
  "story.middleBadge": { en: "in between", ko: "중간" },
  "story.drives": { en: "drives", ko: "이끔" },
  "story.tapHint": { en: "tap to open", ko: "눌러서 열기" },
  "story.piecesInSide": { en: "Pieces on this side", ko: "이 면의 조각들" },
  "story.whyConnect": { en: "Why these connect", ko: "이것들이 이어지는 이유" },
  "story.noReason": { en: "Connected by the team (no note added).", ko: "팀이 연결함 (메모 없음)." },
  "story.close": { en: "Close", ko: "닫기" },
  "story.rootWhy": {
    en: "Few links, but nothing upstream drives it — so the rest seem to grow from here.",
    ko: "연결은 적지만 위에서 이걸 이끄는 게 없어요 — 그래서 나머지가 여기서 자라난 듯 보여요.",
  },
  "story.singleFacet": {
    en: "Everything fused into one side — no root-to-symptom flow yet. Mark a link as “one affects the other” to reveal direction.",
    ko: "모든 게 한 면으로 묶였어요 — 아직 뿌리→증상 흐름이 없어요. 연결 하나를 “하나가 다른 것에 영향”으로 표시하면 방향이 드러나요.",
  },
  "story.looseHeading": { en: "Not yet in the picture", ko: "아직 그림에 없는 것" },
  "story.looseHint": {
    en: "These pieces are on their own. Go back and connect one to bring it in.",
    ko: "이 조각들은 아직 따로 있어요. 뒤로 가서 하나를 이어 그림에 넣으세요.",
  },
  "story.tensionHeading": { en: "Held in tension", ko: "긴장으로 남은 것" },
  "story.tensionHint": {
    en: "Kept, not resolved — two pieces that genuinely pull apart.",
    ko: "없애지 않고 그대로 — 진짜로 서로 당기는 두 조각.",
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
  "crux.evidenceHeading": { en: "The picture behind it — inspect what you assembled", ko: "그 뒤의 그림 — 여러분이 맞춘 것을 살펴보세요" },
  "crux.evidenceShow": { en: "Show the picture behind it", ko: "그 뒤의 그림 보기" },
  "crux.evidenceHide": { en: "Hide the picture", ko: "그림 접기" },
  "crux.evidenceSub": { en: "The map, story and stats you assembled — open to inspect", ko: "여러분이 맞춘 지도·이야기·수치 — 열어서 살펴보세요" },
  "reveal.pickHint": { en: "How would you like to read the whole?", ko: "전체를 어떻게 읽어볼까요?" },
  "crux.realQuestion": { en: "So the real question is…", ko: "그래서 진짜 질문은…" },
  "crux.editQuestion": { en: "Edit the question", ko: "질문 수정" },

  // ---- decision step (turn the reframed question into the team's own next move) ----
  "decide.label": { en: "So our next move is…", ko: "그래서 우리의 다음 수는…" },
  "decide.badge": { en: "The last step", ko: "마지막 단계" },
  "decide.leadIn": {
    en: "This is where it lands — turn the reframed question into one concrete move your team owns.",
    ko: "여기가 도착점이에요 — 다시 세운 질문을 팀이 책임질 구체적인 한 걸음으로 옮기세요.",
  },
  "decide.hint": {
    en: "The AI reframed the question — the decision is yours. What's the smallest concrete step that answers it, and who owns it?",
    ko: "AI는 질문을 다시 세웠을 뿐 — 결정은 여러분 몫이에요. 이 질문에 답하는 가장 작은 구체적 한 걸음은 무엇이고, 누가 맡나요?",
  },
  "decide.placeholder": {
    en: "e.g. By Friday, Dana names one owner for the audit log and protects it on the roadmap.",
    ko: "예: 금요일까지 Dana가 감사 로그 담당자를 한 명 정하고 로드맵에서 보호한다.",
  },
  "decide.add": { en: "Write our next move", ko: "다음 수 적기" },
  "decide.edit": { en: "Edit", ko: "수정" },
  "decide.saved": { en: "Our decision — not the AI's", ko: "우리의 결정 — AI가 아니라" },
  // decision directions — grounded starting points, not authored decisions
  "decide.stuck": { en: "Not sure where to start?", ko: "어디서 시작할지 막막한가요?" },
  "decide.getDirections": { en: "Suggest starting directions", ko: "시작할 방향 제안받기" },
  "decide.directionsLoading": { en: "Reading your shape…", ko: "여러분의 그림을 읽는 중…" },
  "decide.directionsHint": {
    en: "Directions drawn from the shape you built — pick one to start from, then make it your own.",
    ko: "여러분이 만든 그림에서 뽑은 방향이에요 — 하나를 골라 시작한 뒤, 여러분의 것으로 다듬으세요.",
  },
  "decide.useDirection": { en: "Start from this", ko: "이걸로 시작" },
  "decide.directionsAgain": { en: "Other directions", ko: "다른 방향" },
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
  "common.aiFailed": {
    en: "The AI couldn't be reached — this isn't about your pieces. Check the connection and try again.",
    ko: "AI에 연결하지 못했어요 — 조각의 문제가 아니에요. 연결을 확인하고 다시 시도해 주세요.",
  },
  "common.retry": { en: "Try again", ko: "다시 시도" },

  // ---- blind spot (Connect): a vantage the pieces don't yet cover ----
  "blind.check": { en: "Check for a missing angle", ko: "빠진 관점 확인하기" },
  "blind.checkSub": {
    en: "The AI names one angle no one has taken — an under-heard role, or someone not in the room at all (the \"empty chair\") — and asks what they'd say. You write it.",
    ko: "AI가 아직 아무도 안 잡은 관점 하나를 짚어줘요 — 덜 들린 역할이거나, 아예 여기 없는 사람(\"빈 의자\")이거나. 그 사람이 뭐라 할지는 여러분이 적어요.",
  },
  "blind.checking": { en: "Looking at who's missing…", ko: "누가 빠졌는지 보는 중…" },
  "blind.found": { en: "A perspective no one has added", ko: "아직 아무도 안 적은 관점" },
  "blind.none": {
    en: "The pieces cover this from several sides already — no obvious gap.",
    ko: "여러 방향에서 이미 잘 짚었어요 — 뚜렷한 빈 곳은 없네요.",
  },
  "blind.why": { en: "Why this reads as missing", ko: "왜 비어 보이나" },
  "blind.fill": { en: "Add a piece from this seat", ko: "이 자리에서 조각 쓰기" },
  "blind.dismiss": { en: "Not a gap — show another", ko: "빈 곳 아님 — 다른 관점" },
  "blind.another": { en: "Show another angle", ko: "다른 관점 보기" },
  "blind.exhausted": {
    en: "That's every angle we can see missing. Add one, or carry on connecting.",
    ko: "저희가 보기엔 빠진 관점은 이게 전부예요. 하나 추가하거나, 계속 이어가세요.",
  },
  "blind.hide": { en: "Hide", ko: "닫기" },
  "blind.reopen": { en: "Check for a missing angle again", ko: "빠진 관점 다시 확인" },

  // ---- trade-off (after the decision): what it commits to giving up ----
  "trade.label": { en: "What this decision gives up", ko: "이 결정이 포기하는 것" },
  "trade.checking": { en: "Reading the cost…", ko: "대가를 읽는 중…" },
  "trade.favors": { en: "Leans toward", ko: "택하는 쪽" },
  "trade.cost": { en: "Gives way", ko: "밀리는 쪽" },
  "trade.none": {
    en: "No kept tension lines up with this decision — nothing obvious is being traded off.",
    ko: "이 결정과 맞물리는 긴장이 없어요 — 뚜렷이 포기하는 건 없어 보여요.",
  },
  "trade.grounded": {
    en: "Read from your own board — not advice, just one real cost made visible.",
    ko: "여러분의 보드에서 읽은 거예요 — 조언이 아니라, 진짜 대가 하나를 드러낸 것.",
  },
  // the contest — is the AI's named cost right?
  "trade.ask": { en: "Is that the real cost?", ko: "그게 진짜 대가가 맞나요?" },
  "trade.accept": { en: "Yes, that's the cost", ko: "네, 그게 대가예요" },
  "trade.relocate": { en: "No — the real cost is…", ko: "아니요 — 진짜 대가는…" },
  "trade.reject": { en: "We don't accept that framing", ko: "그 프레이밍은 받아들이지 않아요" },
  "trade.notePlaceholder": { en: "In your own words…", ko: "여러분의 말로…" },
  "trade.answered.accepted": { en: "✓ You took the cost as named.", ko: "✓ 그 대가를 그대로 받아들였어요." },
  "trade.answered.relocated": { en: "↳ You moved the cost.", ko: "↳ 대가를 옮겼어요." },
  "trade.answered.rejected": { en: "✕ You rejected the framing.", ko: "✕ 프레이밍을 거부했어요." },
  "trade.why": {
    en: "You just wrote a decision — here's the cost it commits to, read off the tensions you kept.",
    ko: "방금 결정을 적으셨죠 — 여러분이 남겨둔 긴장에서 읽은, 그 결정이 치르는 대가예요.",
  },
  "trade.revise": { en: "Revise our decision", ko: "결정 다시 손보기" },
  "trade.another": { en: "See another cost", ko: "다른 대가도 보기" },

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
    // record the switch first — relocalize early-returns on a blank table, so it can't
    // be the thing that logs this, and a mixed-language export needs the provenance.
    useSession.getState().setLang(l);
    // re-project any loaded sample-scenario content (fragments, pre-baked bridges)
    // into the new language so a mid-test switch actually takes effect.
    useSession.getState().relocalize(l);
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
