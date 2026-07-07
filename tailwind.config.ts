import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1a1a1f",
          soft: "#3a3a44",
          faint: "#71717a",
        },
        paper: {
          DEFAULT: "#fbfbfa",
          card: "#ffffff",
          sunken: "#f4f4f2",
        },
        line: "#e6e6e2",
        // relation type accents — muted, modern
        overlap: "#4f8a8b",
        tension: "#c26b5a",
        dependency: "#6b6ba8",
        complement: "#9a8248",
        accent: {
          DEFAULT: "#2f6f6b",
          soft: "#e6f0ef",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,31,0.04), 0 4px 16px rgba(26,26,31,0.06)",
        lift: "0 4px 12px rgba(26,26,31,0.08), 0 12px 32px rgba(26,26,31,0.10)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "draw-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease both",
        "draw-in": "draw-in 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
