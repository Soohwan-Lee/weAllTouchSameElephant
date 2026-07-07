import type { RelationType } from "./types";
import type { TKey } from "./i18n";

export const RELATION_META: Record<
  RelationType,
  { color: string; stroke: string; labelKey: TKey; shortKey: TKey; dash?: string }
> = {
  overlap: { color: "#4f8a8b", stroke: "#4f8a8b", labelKey: "rel.overlap", shortKey: "rel.overlap.short" },
  tension: {
    color: "#c26b5a",
    stroke: "#c26b5a",
    labelKey: "rel.tension",
    shortKey: "rel.tension.short",
    dash: "6 5",
  },
  dependency: {
    color: "#6b6ba8",
    stroke: "#6b6ba8",
    labelKey: "rel.dependency",
    shortKey: "rel.dependency.short",
  },
  complement: {
    color: "#9a8248",
    stroke: "#9a8248",
    labelKey: "rel.complement",
    shortKey: "rel.complement.short",
  },
};
