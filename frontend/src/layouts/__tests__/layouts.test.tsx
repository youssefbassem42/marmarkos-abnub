import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AttendanceLayout } from "../AttendanceLayout";
import { AdminLayout } from "../AdminLayout";

function renderWithProviders(ui: ReactElement, initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

/**
 * Regression: the check-in split screen rendered AdminTopbar's
 * SidebarTrigger outside a SidebarProvider; the hook threw during render
 * and the router error boundary showed "Access denied" to every role.
 */
describe("attendance layouts", () => {
  it("renders the check-in screen with a back link, not a sidebar trigger", () => {
    renderWithProviders(<AttendanceLayout />, ["/admin/attendance/check-in"]);

    // The brand panel owns one h1, the topbar another.
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByLabelText("Toggle sidebar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رجوع" })).toBeInTheDocument();
  });

  it("keeps the sidebar trigger working inside a SidebarProvider", () => {
    renderWithProviders(
      <SidebarProvider>
        <AdminTopbar title="لوحة المتابعة" />
      </SidebarProvider>,
      ["/admin/dashboard"],
    );

    expect(screen.getByLabelText("Toggle sidebar")).toBeInTheDocument();
  });

  it("renders the admin shell without throwing", () => {
    renderWithProviders(<AdminLayout />, ["/admin/dashboard"]);
  });

  it("check-in route renders AttendanceLayout without a SidebarProvider", () => {
    renderWithProviders(<AttendanceLayout />, ["/admin/attendance/check-in"]);

    // AttendanceLayout owns its split shell; it must not wrap itself in
    // a SidebarProvider (that is AdminLayout's job) — regression guard
    // for the D-15 move under /admin.
    expect(screen.queryByLabelText("Toggle sidebar")).not.toBeInTheDocument();
  });

  it("notifications route renders AdminLayout with exactly one SidebarProvider", () => {
    const { container } = renderWithProviders(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="notifications" element={<div>feed</div>} />
        </Route>
      </Routes>,
      ["/admin/notifications"],
    );

    // One provider wrapper only: a double provider would silently break
    // the sidebar's collapsed state.
    expect(screen.getByText("feed")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[class*="group/sidebar-wrapper"]').length,
    ).toBe(1);
  });
});
