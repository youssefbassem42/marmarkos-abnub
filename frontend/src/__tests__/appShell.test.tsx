/**
 * The shell of the application.
 *
 * The providers wait for the session before the router is mounted: with
 * the memory persistence the access token is only known after the
 * restore, and the guard would send a signed-in member to the login
 * page on every reload (SEC-004).
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

const restore = vi.fn();

vi.mock("@/lib/session", () => ({
  restoreSession: () => restore(),
}));

afterEach(() => {
  restore.mockReset();
});

describe("the shell of the application", () => {
  it("shows the start-up screen while the session is restored", async () => {
    let release: (() => void) | undefined;
    restore.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(<App />);

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getByText("جارٍ التحميل...")).toBeInTheDocument();

    release?.();
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
  });

  it("mounts the router once the session is restored", async () => {
    restore.mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByText("جارٍ التحميل...")).not.toBeInTheDocument(),
    );
  });
});
