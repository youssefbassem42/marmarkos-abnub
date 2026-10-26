import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodResolver } from "../zodResolver";

/**
 * The local Zod → react-hook-form resolver.
 *
 * It replaced `@hookform/resolvers/zod` (whose v6 line cannot be installed
 * next to the `effect` peer it drags in), so its behaviour is pinned here:
 * parsed values on success, one field error per issue path on failure.
 */

const schema = z.object({
  email: z.string().trim().email("بريد غير صالح"),
  password: z.string().min(8, "كلمة المرور قصيرة"),
});

describe("zodResolver", () => {
  it("returns the parsed values when the input is valid", async () => {
    const resolver = zodResolver(schema);

    const result = await resolver(
      { email: "  member@example.com  ", password: "long-enough-password" },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    );

    expect(result.errors).toEqual({});
    // The trimmed value is what reaches the form state.
    expect(result.values).toEqual({
      email: "member@example.com",
      password: "long-enough-password",
    });
  });

  it("maps every issue to a field error keyed by its path", async () => {
    const resolver = zodResolver(schema);

    const result = await resolver(
      { email: "nope", password: "short" },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    );

    expect(result.values).toEqual({});
    expect(result.errors).toEqual({
      email: { type: "validation", message: "بريد غير صالح" },
      password: { type: "validation", message: "كلمة المرور قصيرة" },
    });
  });

  it("keys nested issues with the dotted path", async () => {
    const nested = z.object({
      options: z.array(z.object({ text: z.string().min(1, "فارغ") })).min(1),
    });
    const resolver = zodResolver(nested);

    const result = await resolver(
      { options: [{ text: "" }] },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    );

    expect(result.errors).toEqual({
      "options.0.text": { type: "validation", message: "فارغ" },
    });
  });

  it("keeps the first issue of a path", async () => {
    const resolver = zodResolver(schema);

    const result = await resolver(
      { email: "", password: "" },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    );

    expect(result.errors.email).toEqual({
      type: "validation",
      message: expect.any(String) as unknown as string,
    });
  });
});
