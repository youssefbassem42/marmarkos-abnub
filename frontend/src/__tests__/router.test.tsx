/**
 * The table of the routes.
 *
 * The router is the map of the platform: a route that points at the
 * wrong page, or a guard that lets a member into the administration,
 * is a defect that no other test would see. The table is checked here:
 * the paths that must exist, the 404 of an unknown path, the 403 of a
 * member who tries to open the administration, and the login of an
 * anonymous visitor.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RegisteredUser } from "@/lib/api";
import { installApi, makeQueryClient } from "@/test/pageHarness";

const MEMBER: RegisteredUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
  first_name: "محمود",
  last_name: "عبد الله",
  phone: null,
  date_of_birth: null,
  address: null,
  avatar: null,
  role: "MEMBER",
  status: "ACTIVE",
  public_id: "M-0001",
  created_at: "2026-01-01T00:00:00Z",
  has_password: true,
  email_verified: true,
};

/**
 * Load the router at the given address and render it.
 *
 * The module registry is reset first: the router is built once, from
 * the address of the browser. Every test needs its own router - and
 * its own copy of the session, because the guard reads the token from
 * the memory of the module.
 */
async function renderRouterAt(path: string, user?: RegisteredUser) {
  window.history.pushState({}, "", path);
  vi.resetModules();
  installApi({});

  if (user) {
    const auth = await import("@/lib/auth");
    auth.saveAuth({ accessToken: "token", user }, false);
  }

  const module = await import("@/router");
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={module.router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.resetModules();
});

describe("the table of the routes", () => {
  it("has a route for every screen of the platform", async () => {
    window.history.pushState({}, "", "/");
    vi.resetModules();
    const module = await import("@/router");
    const router = module.router;

    const paths = router.routes
      .flatMap((route) => [
        route.path,
        ...(route.children ?? []).map((child) => child.path),
      ])
      .filter((path): path is string => typeof path === "string");

    for (const expected of [
      "/",
      "/register",
      "/login",
      "/forgot-password",
      "/reset-password",
      "/profile",
      "/notifications",
      "*",
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it("shows the 404 of an address that does not exist", async () => {
    await renderRouterAt("/no-such-page");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "الصفحة غير موجودة" }),
      ).toBeInTheDocument(),
    );
  });

  it("sends a member away from the administration", async () => {
    await renderRouterAt("/admin/dashboard", MEMBER);

    await waitFor(
      () =>
        expect(
          screen.getByRole("heading", { name: "لا تملك صلاحية الوصول" }),
        ).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("lets a servant into the administration", async () => {
    await renderRouterAt("/admin/dashboard", {
      ...MEMBER,
      role: "ADMIN",
    });

    await waitFor(
      () =>
        expect(
          screen.queryByRole("heading", { name: "لا تملك صلاحية الوصول" }),
        ).not.toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("lets a member into his notifications", async () => {
    await renderRouterAt("/notifications", MEMBER);

    await waitFor(
      () =>
        expect(
          screen.queryByRole("heading", { name: "لا تملك صلاحية الوصول" }),
        ).not.toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("sends an anonymous visitor to the login page", async () => {
    await renderRouterAt("/profile");

    await waitFor(
      () =>
        expect(
          screen.getByRole("heading", { name: "مرحبًا بعودتك!" }),
        ).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("redirects the old gallery address to the landing page", async () => {
    await renderRouterAt("/gallery");

    await waitFor(() =>
      expect(window.location.pathname).toBe("/"),
    );
  });

  it("renders the landing page without a link to the gallery", async () => {
    await renderRouterAt("/");

    expect(
      screen.queryByRole("link", { name: /معرض الصور/ }),
    ).not.toBeInTheDocument();
  });
});
