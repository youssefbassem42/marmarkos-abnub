import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { resources } from "@/i18n/index";

/**
 * Arabic-only guard: the platform is Arabic-only. The English resource
 * file has been removed; this test ensures it stays gone and that i18n
 * is configured for Arabic only.
 */
describe("Arabic-only i18n guard", () => {
  it("only has the Arabic resource", () => {
    expect(Object.keys(resources)).toEqual(["ar"]);
  });

  it("i18n language is ar", () => {
    expect(i18n.language).toBe("ar");
  });

  it("no en.ts resource file exists", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const globResult = import.meta.glob("../resources/*.ts");
    const keys = Object.keys(globResult);
    const enFiles = keys.filter((k) => /en\.ts$/.test(k));
    expect(
      enFiles,
      `English resource files found: ${enFiles.join(", ")}`,
    ).toEqual([]);
  });
});
