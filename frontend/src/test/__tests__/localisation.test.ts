import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DIRECTION_BY_LANGUAGE } from "@/i18n/direction";

/**
 * ARCH-007 / REUSE-006: one direction, one language, one place.
 *
 * The platform ships Arabic only. The document root carries the
 * direction (`<html lang="ar" dir="rtl">`) and every element inherits
 * it, so a component that repeats `dir="rtl"` says nothing new - it
 * only creates the impression that a second language is one line away.
 *
 * The same goes for the `lang` prop of the auth components: it was
 * typed `"ar" | "en"`, it was never branched on, and the English
 * bundle was removed from the project. It is gone.
 */

interface AllowEntry {
  file: string;
  reason: string;
}

const ALLOWLIST: AllowEntry[] = [
  {
    file: "i18n/direction.ts",
    reason: "the rule itself is written down there",
  },
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        walk(full);
      } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

function isAllowed(relative: string): boolean {
  return ALLOWLIST.some((entry) => entry.file === relative);
}

describe("the direction lives in one place (ARCH-007)", () => {
  it('finds no hard-coded dir="rtl" in the components', () => {
    const violations: string[] = [];

    for (const fullPath of listSourceFiles("src")) {
      const relative = fullPath.replace(/^src[/\\]/, "").replace(/\\/g, "/");
      if (isAllowed(relative)) continue;

      readFileSync(fullPath, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (line.includes('dir="rtl"')) {
            violations.push(`${relative}:${index + 1}`);
          }
        });
    }

    expect(
      violations,
      `The direction is inherited from the document root; remove dir="rtl":\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the direction on the document root", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
  });

  it("has no component that declares a bilingual language prop", () => {
    const violations: string[] = [];

    for (const fullPath of listSourceFiles("src")) {
      const relative = fullPath.replace(/^src[/\\]/, "").replace(/\\/g, "/");
      const text = readFileSync(fullPath, "utf8");

      if (text.includes('"ar" | "en"') || text.includes("'ar' | 'en'")) {
        violations.push(relative);
      }
    }

    expect(
      violations,
      `The platform ships Arabic only; the "en" arm is dead:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("maps the language of the platform to its direction", () => {
    expect(DIRECTION_BY_LANGUAGE.ar).toBe("rtl");
  });

  it("keeps every allowlist entry justified", () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(5);
    }
  });
});
