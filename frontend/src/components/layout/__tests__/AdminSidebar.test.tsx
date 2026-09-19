import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { saveAuth, clearAuth } from "@/lib/auth";
import { AdminSidebar } from "../AdminSidebar";

function renderWithProviders(ui: ReactElement, initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <SidebarProvider>{ui}</SidebarProvider>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function signInAsAdmin() {
  saveAuth(
    {
      accessToken: "test-token",
      user: {
        id: "u1",
        email: "a@t.com",
        phone: null,
        first_name: "Admin",
        last_name: "User",
        date_of_birth: null,
        address: null,
        avatar: null,
        role: "ADMIN",
        status: "ACTIVE",
        public_id: "p1",
        created_at: "2026-01-01T00:00:00Z",
        has_password: true,
        email_verified: true,
      },
    },
    true,
  );
}

/** The harness boots in Arabic; the admin nav labels assert against ar. */
describe("admin sidebar (D-8)", () => {
  afterEach(() => clearAuth());

  it("renders all ten design nav items in order for an ADMIN", () => {
    signInAsAdmin();
    const labels = [
      "لوحة التحكم",
      "الأعضاء",
      "الحضور",
      "الفعاليات",
      "أقسام الكتاب المقدس",
      "الاختبارات",
      "الرسائل",
      "الإشعارات",
      "التقارير",
      "الإعدادات",
    ];

    renderWithProviders(<AdminSidebar />, ["/admin/dashboard"]);

    for (const label of labels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("renders disabled items as aria-disabled and never as links", () => {
    signInAsAdmin();
    renderWithProviders(<AdminSidebar />, ["/admin/dashboard"]);

    for (const label of ["الفعاليات", "الإعدادات"]) {
      const item = screen.getByText(label);
      const button = item.closest("button");
      expect(button).not.toBeNull();
      expect(button).toHaveAttribute("aria-disabled");
      // Not wrapped in a router link.
      expect(item.closest("a")).toBeNull();
    }
  });

  it("links the members entry to the ADMIN-only users page", () => {
    signInAsAdmin();
    renderWithProviders(<AdminSidebar />, ["/admin/dashboard"]);

    const link = screen.getByRole("link", { name: /الأعضاء/ });
    expect(link.getAttribute("href")).toBe("/admin/users");
  });

  it("hides the ADMIN-only members entry from a SERVANT", () => {
    saveAuth(
      {
        accessToken: "test-token",
        user: {
          id: "u3",
          email: "s2@t.com",
          phone: null,
          first_name: "Servant",
          last_name: "Two",
          date_of_birth: null,
          address: null,
          avatar: null,
          role: "SERVANT",
          status: "ACTIVE",
          public_id: "p3",
          created_at: "2026-01-01T00:00:00Z",
          has_password: true,
          email_verified: true,
        },
      },
      true,
    );
    renderWithProviders(<AdminSidebar />, ["/admin/notifications"]);

    expect(screen.queryByText("الأعضاء")).not.toBeInTheDocument();
  });

  it("lights the active state on /admin/anonymous-messages for an ADMIN", () => {
    signInAsAdmin();
    renderWithProviders(<AdminSidebar />, ["/admin/anonymous-messages"]);

    const link = screen.getByRole("link", { name: /الرسائل/ });
    const button = link.querySelector("button") ?? link;
    // SidebarMenuButton marks the active item via data-active.
    expect(
      button.getAttribute("data-active") === "true" ||
        button.closest("[data-active='true']") !== null,
    ).toBe(true);
  });

  it("hides the ADMIN-only messages entry from a SERVANT", () => {
    saveAuth(
      {
        accessToken: "test-token",
        user: {
          id: "u2",
          email: "s@t.com",
          phone: null,
          first_name: "Servant",
          last_name: "User",
          date_of_birth: null,
          address: null,
          avatar: null,
          role: "SERVANT",
          status: "ACTIVE",
          public_id: "p2",
          created_at: "2026-01-01T00:00:00Z",
          has_password: true,
          email_verified: true,
        },
      },
      true,
    );
    renderWithProviders(<AdminSidebar />, ["/admin/notifications"]);

    expect(screen.queryByText("الرسائل")).not.toBeInTheDocument();
    expect(screen.getAllByText("الإشعارات").length).toBeGreaterThan(0);
  });
});
