/**
 * The schemas of the answers must be **used**.
 *
 * A schema that no endpoint uses is a copy of the contract that drifts
 * alone: it gives the false impression that the endpoint is checked.
 * This test reads the schemas of the library and the clients of the
 * modules, and fails when a schema is not used by any client.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** Every file of the frontend (the tests included - they use them too). */
function everyFile(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return everyFile(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (path.includes("/__tests__/")) return [];
    return [path];
  });
}

/** The code of a file, without its comments. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("the schemas of the answers", () => {
  it("are all used by a client", () => {
    const schemaFiles = everyFile(join(SRC, "lib", "schemas"));
    const files = everyFile(SRC);
    const contents = files.map((path) => readFileSync(path, "utf8"));

    const unused: string[] = [];

    for (const schemaFile of schemaFiles) {
      const source = readFileSync(schemaFile, "utf8");
      // Every schema the file declares.
      const names = [...source.matchAll(/export const (\w+Schema)\b/g)].map(
        (match) => match[1],
      );

      for (const name of names) {
        const used = contents.some(
          (content, index) =>
            files[index] !== schemaFile &&
            new RegExp(`\\b${name}\\b`).test(content),
        );
        if (!used) unused.push(name);
      }
    }

    expect(unused).toEqual([]);
  });

  it("keep the fields they do not know about", () => {
    // A schema that strips the unknown fields would silently remove the
    // data the page reads (zod removes them by default).
    const files = everyFile(join(SRC, "lib", "schemas"));
    for (const path of files) {
      const code = withoutComments(readFileSync(path, "utf8"));
      expect(code).not.toMatch(/\bz\.object\(/);
    }
  });
});
