/**
 * The schemas of the answers must be **used**.
 *
 * A schema that no endpoint uses is a copy of the contract that drifts
 * alone: it gives the false impression that the endpoint is checked.
 *
 * A schema may be used by another schema (a building block), so the
 * test follows the references: a schema is used when a **client**
 * (a file outside the schemas folder) reaches it, directly or through
 * the schemas that the client uses.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const SCHEMAS = join(SRC, "lib", "schemas");

/** Every file of the frontend. */
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

/** The name of every schema a file declares. */
function declaredSchemas(source: string): string[] {
  return [...source.matchAll(/export const (\w+Schema)\b/g)].map(
    (match) => match[1],
  );
}

/** The name of every schema a file mentions. */
function mentionedSchemas(source: string): string[] {
  return [...source.matchAll(/\b(\w+Schema)\b/g)].map((match) => match[1]);
}

describe("the schemas of the answers", () => {
  it("are all used by a client", () => {
    const schemaFiles = everyFile(SCHEMAS);
    const clientFiles = everyFile(SRC).filter(
      (path) => !path.startsWith(SCHEMAS),
    );

    // The schemas every client mentions.
    const seeds = new Set(
      clientFiles.flatMap((path) =>
        mentionedSchemas(withoutComments(readFileSync(path, "utf8"))),
      ),
    );

    // The schemas every schema file mentions (the building blocks).
    const inside = new Map<string, string[]>();
    for (const path of schemaFiles) {
      const source = withoutComments(readFileSync(path, "utf8"));
      const declared = declaredSchemas(source);
      const mentioned = mentionedSchemas(source);
      for (const name of declared) {
        inside.set(
          name,
          mentioned.filter((other) => other !== name),
        );
      }
    }

    // The closure: a client reaches a schema and the schemas it uses.
    const reachable = new Set<string>();
    const queue = [...seeds];
    while (queue.length > 0) {
      const name = queue.pop();
      if (!name || reachable.has(name)) continue;
      reachable.add(name);
      queue.push(...(inside.get(name) ?? []));
    }

    const unused = [...inside.keys()].filter((name) => !reachable.has(name));

    expect(unused).toEqual([]);
  });

  it("keep the fields they do not know about", () => {
    // A schema that strips the unknown fields would silently remove the
    // data the page reads (zod removes them by default).
    for (const path of everyFile(SCHEMAS)) {
      const code = withoutComments(readFileSync(path, "utf8"));
      expect(code).not.toMatch(/\bz\.object\(/);
    }
  });
});
