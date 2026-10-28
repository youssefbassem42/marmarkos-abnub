/**
 * The accents of the notifications.
 *
 * Every type of the backend has an accent (an icon and a colour). A
 * type without one made the icon `undefined`, and React refused to
 * render it: the list of the notifications **crashed** for the manager
 * who received a notification of a published verse (`BIBLE_VERSE`,
 * a type of Phase 5 that the frontend did not know).
 *
 * The test pins two things:
 * * every type of the backend has an accent;
 * * a type of the future does not crash (it falls back).
 */

import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_ACCENTS,
  resolveAccent,
} from "@/modules/notifications/components/accents";
import type { NotificationType } from "@/modules/notifications/types";

/** The types of the backend (`NotificationType` of the backend). */
const BACKEND_TYPES = [
  "BLOG_POST",
  "ANNOUNCEMENT",
  "ATTENDANCE",
  "SYSTEM",
  "BIBLE_VERSE",
] as const;

describe("the accents of the notifications", () => {
  it("has an accent for every type of the backend", () => {
    for (const type of BACKEND_TYPES) {
      expect(NOTIFICATION_ACCENTS[type]).toBeDefined();
      expect(NOTIFICATION_ACCENTS[type].Icon).toBeDefined();
    }
  });

  it("does not crash on a type of the future", () => {
    const unknown = "A_TYPE_OF_THE_FUTURE" as NotificationType;

    const accent = resolveAccent(unknown);

    expect(accent.Icon).toBeDefined();
  });

  it("lets the notification choose its icon inside the allowlist", () => {
    const accent = resolveAccent("ANNOUNCEMENT", "Trophy");

    expect(accent.Icon).toBeDefined();
  });

  it("ignores an icon that is not in the allowlist", () => {
    const accent = resolveAccent("ANNOUNCEMENT", "<script>alert(1)</script>");

    expect(accent.Icon).toBe(NOTIFICATION_ACCENTS.ANNOUNCEMENT.Icon);
  });
});
