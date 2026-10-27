import { describe, expect, it } from "vitest";

/**
 * The bundle of the production image must not point at localhost.
 *
 * The image is served by nginx, which proxies /api to the backend. If the
 * bundle asks for "http://localhost:8000/api/v1", the browser of the member
 * calls its own machine and every call fails. The check reads the built
 * files when they are there (the image build / the CI build) and skips
 * itself when they are not (the unit tests run before the build).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = join(process.cwd(), "dist");

function builtFiles(): string[] {
  if (!existsSync(DIST)) return [];
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith(".js")) {
        found.push(path);
      }
    }
  };
  walk(DIST);
  return found;
}

describe("the built bundle", () => {
  const files = builtFiles();

  it.skipIf(files.length === 0)("never asks for localhost", () => {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toContain("http://localhost:8000/api");
      expect(content).not.toContain("http://127.0.0.1:8000/api");
    }
  });

  it.skipIf(files.length === 0)("asks for the relative path of the API", () => {
    const content = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(content).toContain("/api/v1");
  });
});
