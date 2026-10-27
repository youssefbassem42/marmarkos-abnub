/**
 * The route guards.
 *
 * They are the only thing between a member and a page they may not
 * see: the authentication and the role have to be checked, and the
 * member has to be sent somewhere sensible.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequireAuth } from "@/components/common/RequireAuth";
import { RequireRole } from "@/components/common/RequireRole";
import * as auth from "@/lib/auth";

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/admin" element={element} />
        <Route path="/profile" element={<div>profile page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RequireAuth", () => {
  it("sends an anonymous visitor to the login page", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue(null);

    renderAt("/admin", <RequireAuth />);

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the route for a signed-in member", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue("token");

    renderAt(
      "/admin",
      <RequireAuth>
        <div>admin page</div>
      </RequireAuth>,
    );

    expect(screen.getByText("admin page")).toBeInTheDocument();
  });

  it("renders the outlet when it has no children", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue("token");

    renderAt("/admin", <RequireAuth />);

    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("shows the forbidden page to a member without the role", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue("token");
    vi.spyOn(auth, "hasAnyRole").mockReturnValue(false);

    renderAt(
      "/admin",
      <RequireRole roles={["ADMIN"]}>
        <div>admin page</div>
      </RequireRole>,
    );

    expect(screen.queryByText("admin page")).not.toBeInTheDocument();
    expect(screen.getByText("لا تملك صلاحية الوصول")).toBeInTheDocument();
  });

  it("renders the route for a member with the role", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue("token");
    vi.spyOn(auth, "hasAnyRole").mockReturnValue(true);

    renderAt(
      "/admin",
      <RequireRole roles={["ADMIN"]}>
        <div>admin page</div>
      </RequireRole>,
    );

    expect(screen.getByText("admin page")).toBeInTheDocument();
  });

  it("asks for the roles it was given", () => {
    vi.spyOn(auth, "getAccessToken").mockReturnValue("token");
    const hasAnyRole = vi.spyOn(auth, "hasAnyRole").mockReturnValue(true);

    renderAt(
      "/admin",
      <RequireRole roles={["ADMIN", "SERVANT"]}>
        <div>admin page</div>
      </RequireRole>,
    );

    expect(hasAnyRole).toHaveBeenCalledWith("ADMIN", "SERVANT");
  });
});
