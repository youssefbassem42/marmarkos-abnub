import { useLanguage } from "./context";

/**
 * The direction of the text flow.
 *
 * The platform ships Arabic only (the English bundle was removed), so
 * the direction is "rtl" everywhere - but it is written down in one
 * place instead of being repeated in every component.
 */
export type Direction = "rtl" | "ltr";

/** The direction of every language the platform knows. */
export const DIRECTION_BY_LANGUAGE: Record<string, Direction> = {
  ar: "rtl",
};

/**
 * The direction of the current language.
 *
 * The components do not write `dir="rtl"` themselves: the document
 * root carries the direction (see index.html and the LanguageProvider),
 * and every element inherits it. A component that needs the opposite
 * direction (a number, an e-mail address, a chart) writes `dir="ltr"`
 * on purpose - that is a real switch, not a repetition.
 */
export function useDirection(): Direction {
  const { language } = useLanguage();
  return DIRECTION_BY_LANGUAGE[language] ?? "rtl";
}
