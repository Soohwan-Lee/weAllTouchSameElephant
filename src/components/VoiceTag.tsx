"use client";

import { useI18n } from "@/lib/i18n";

/**
 * Who is speaking in this block.
 *
 * The final screen stacks four blocks that look alike but are four different speech acts:
 * the AI *proposes* a reading, *asks* a question, the team *commits* to a move, and the AI
 * *names* what that move costs. Rendered as four similar paragraphs, a reader has to parse
 * each one to work out whether it is a suggestion they may reject or a decision they made —
 * which is exactly the work a group should not have to do while arguing.
 *
 * Where AI output sits and how prominent it looks is a social variable in group settings, not
 * a cosmetic one: the same text reads as either over-weighted or ignorable depending on its
 * framing. So the provenance is stated rather than implied, in one scannable line.
 *
 * `ai`   — a proposal. The team may keep it, rewrite it, or throw it away.
 * `team` — the team's own words. The AI never authored these.
 */
export function VoiceTag({ who }: { who: "ai" | "team" }) {
  const { t } = useI18n();
  const isAI = who === "ai";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isAI ? "bg-paper-sunken text-ink-faint" : "bg-accent-soft text-accent"
      }`}
    >
      {isAI ? "◇" : "✍"} {t(isAI ? "voice.ai" : "voice.team")}
    </span>
  );
}
