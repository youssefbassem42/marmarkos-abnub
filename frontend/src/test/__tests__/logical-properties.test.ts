import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BR-17 / P4-902: the RTL regression guard.
 *
 * Scans every app .tsx file for physical direction classes inside
 * `className` strings. A hit fails the build with file:line unless it
 * is on this allowlist — and every allowlist entry carries a one-line
 * justification, because an unexplained entry is how this test dies.
 */

const BANNED_PATTERNS: [string, RegExp][] = [
  ["ml-", /(^|[\s"'`])(-?)ml-\d/],
  ["mr-", /(^|[\s"'`])mr-\d/],
  ["pl-", /(^|[\s"'`])(-?)pl-\d/],
  ["pr-", /(^|[\s"'`])pr-\d/],
  ["left-", /(^|[\s"'`])(-)?left-[\d[]/],
  ["right-", /(^|[\s"'`])(-)?right-[\d[]/],
  ["text-left", /\btext-left\b/],
  ["text-right", /\btext-right\b/],
  ["border-l", /\bborder-l(-|\b)/],
  ["border-r", /\bborder-r(-|\b)/],
  ["rounded-l", /\brounded-l(-)/],
  ["rounded-r", /\brounded-r(-)/],
  ["space-x-", /\bspace-x-/],
];

/** Lines carrying these markers are side-guarded on purpose (P4-302). */
const GUARDED_LINE_MARKERS = [
  "data-[side=",
  "[[data-side=",
  "collapsible=offcanvas]",
];

interface AllowEntry {
  /** Subpath match (relative to src/). */
  file: string;
  /** Restrict to lines containing this substring, when set. */
  onlyWhenLineContains?: string;
  reason: string;
}

// Every entry needs a justification — an unexplained entry is how this
// test dies (plan §15/P4-902).
const ALLOWLIST: AllowEntry[] = [
  // Vendored primitives nothing renders today (D-16 out of scope).
  { file: "components/ui/context-menu.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/menubar.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/navigation-menu.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/carousel.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/resizable.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/chart.tsx", reason: "not rendered anywhere (D-16)" },
  { file: "components/ui/alert.tsx", reason: "not rendered anywhere (verified by import grep)" },
  // Dialog centering is direction-neutral; converting it would break it.
  {
    file: "components/ui/dialog.tsx",
    onlyWhenLineContains: "left-[50%]",
    reason: "centering offset must not flip",
  },
  {
    file: "components/ui/alert-dialog.tsx",
    onlyWhenLineContains: "left-[50%]",
    reason: "centering offset must not flip",
  },
  // Sidebar rail: all remaining physical values sit behind explicit
  // data-side guards that already resolve per placement (P4-302 rule 2).
  {
    file: "components/ui/sidebar.tsx",
    onlyWhenLineContains: "data-side=",
    reason: "side-guarded selectors are intentional",
  },
  {
    file: "components/ui/sidebar.tsx",
    onlyWhenLineContains: "collapsible=offcanvas]",
    reason: "offcanvas slide offsets are side-aware by design",
  },
  // A camera viewport is a square, not a text flow: corners stay
  // physical in both directions (P4-303 documented choice).
  { file: "modules/attendance/components/ScannerFrame.tsx", reason: "camera frame corners must not mirror" },
  // Decorative collage offsets are composed against fixed artwork and
  // deliberately do NOT mirror (§3.11 'deliberately untouched').
  { file: "pages/landing/sections/About.tsx", reason: "decorative collage offsets must not mirror" },
  { file: "pages/landing/sections/Hero.tsx", reason: "decorative collage offsets must not mirror" },
];

function listTsxCandidates(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        walk(full);
      } else if (name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

describe("RTL regression guard (BR-17)", () => {
  it("finds no unexplained physical direction classes", () => {
    const violations: string[] = [];

    for (const fullPath of listTsxCandidates("src")) {
      const relative = fullPath.replace(/^src[/\\]/, "").replace(/\\/g, "/");
      const lines = readFileSync(fullPath, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (!line.includes("className")) return;

        for (const [label, pattern] of BANNED_PATTERNS) {
          if (!pattern.test(line)) continue;
          if (GUARDED_LINE_MARKERS.some((marker) => line.includes(marker))) {
            continue;
          }
          const allowed = ALLOWLIST.some(
            (entry) =>
              entry.file === relative &&
              (entry.onlyWhenLineContains === undefined ||
                line.includes(entry.onlyWhenLineContains)),
          );
          if (!allowed) {
            violations.push(`${relative}:${index + 1}: ${label}`);
          }
        }
      });
    }

    expect(
      violations,
      `Physical direction classes found (convert or justify):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps every allowlist entry justified", () => {
    for (const entry of ALLOWLIST) {
      expect(
        entry.reason?.length ?? 0,
        `allowlist entry without a reason: ${entry.file}`,
      ).toBeGreaterThan(5);
    }
  });
});
