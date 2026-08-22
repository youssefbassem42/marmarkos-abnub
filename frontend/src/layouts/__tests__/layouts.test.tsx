import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
    renderWithProviders(<AttendanceLayout />, ["/attendance/check-in"]);

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
      ["/attendance/dashboard"],
    );

    expect(screen.getByLabelText("Toggle sidebar")).toBeInTheDocument();
  });

  it("renders the admin shell without throwing", () => {
    renderWithProviders(<AdminLayout />, ["/attendance/dashboard"]);
  });
});
