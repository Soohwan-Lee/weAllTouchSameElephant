"use client";

/**
 * A small, friendly inline hint banner. Used to gently guide first-time users
 * at each step ("here's what to do now").
 */
export function Hint({ children, tone = "calm" }: { children: React.ReactNode; tone?: "calm" | "nudge" }) {
  return (
    <div
      className={[
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "nudge"
          ? "border-accent/20 bg-accent-soft text-accent"
          : "border-line bg-paper-card text-ink-soft",
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0 text-base leading-none">{tone === "nudge" ? "👉" : "💡"}</span>
      <div>{children}</div>
    </div>
  );
}
