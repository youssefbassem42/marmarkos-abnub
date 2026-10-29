import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { LanguageProvider } from "@/i18n/LanguageProvider";
import { useLanguage } from "@/i18n/context";
import { DIRECTION_BY_LANGUAGE, useDirection } from "@/i18n/direction";

/**
 * The direction and the language live in one place: the components never
 * write `dir="rtl"` themselves. These tests pin that source of truth.
 */
describe("the language and the direction", () => {
  it("gives the language of the platform", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    expect(result.current.language).toBe("ar");
  });

  it("gives the direction of the language", () => {
    const { result } = renderHook(() => useDirection(), {
      wrapper: LanguageProvider,
    });

    expect(result.current).toBe("rtl");
  });

  it("writes the direction of every language it knows", () => {
    expect(DIRECTION_BY_LANGUAGE).toEqual({ ar: "rtl" });
  });

  it("refuses to work without the provider", () => {
    // The error is the guard against a component that reads the language
    // outside the tree of the platform.
    expect(() => renderHook(() => useLanguage())).toThrow(
      /useLanguage must be used within a LanguageProvider/,
    );
  });
});
