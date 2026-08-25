import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/resources/ar";
import { en } from "@/i18n/resources/en";

type Plain = Record<string, unknown>;

/** Collect every leaf keypath; arrays contribute index paths + length. */
function collectKeys(node: unknown, prefix = "", into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child, index) => {
      collectKeys(child, `${prefix}.${index}`, into);
    });
    into.add(`${prefix}.__length__:${node.length}`);
    return into;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Plain)) {
      collectKeys(value, prefix ? `${prefix}.${key}` : key, into);
    }
    if (prefix) {
      into.add(`${prefix}.__object__`);
    }
    return into;
  }
  into.add(prefix);
  return into;
}

function diffPaths(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((key) => !b.has(key)).sort();
}

/**
 * P4-901: ar and en must expose identical recursive key sets, including
 * array lengths. Arabic is the source of truth (§0.10); this guard
 * reports EVERY missing key per side, not just the first.
 */
describe("i18n parity", () => {
  it("ar and en expose identical recursive key sets", () => {
    const arKeys = collectKeys(ar);
    const enKeys = collectKeys(en);

    const missingInEn = diffPaths(arKeys, enKeys);
    const missingInAr = diffPaths(enKeys, arKeys);

    const report = [
      ...missingInEn.map((key) => `missing in EN: ${key}`),
      ...missingInAr.map((key) => `missing in AR: ${key}`),
    ];

    expect(report, `i18n parity drift detected:\n${report.join("\n")}`).toEqual([]);
  });
});
