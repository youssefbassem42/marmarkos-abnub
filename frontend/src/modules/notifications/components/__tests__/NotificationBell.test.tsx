import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { clearAuth, saveAuth } from "@/lib/auth";

vi.mock("@/modules/notifications/api", () => ({
  notificationsApi: {
    summary: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    push: vi.fn(),
  },
}));

import { notificationsApi } from "@/modules/notifications/api";
import { NotificationBell } from "../NotificationBell";

const mockedSummary = vi.mocked(notificationsApi.summary);

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

/** Harness boots in Arabic (`lng: "ar"`); assert Arabic strings. */
describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuth();
    signIn();
  });

  function signIn() {
    saveAuth(
      {
        accessToken: "t",
        user: {
          id: "u1",
          email: "a@t.com",
          phone: null,
          first_name: null,
          last_name: null,
          date_of_birth: null,
          address: null,
          avatar: null,
          role: "MEMBER",
          status: "ACTIVE",
          public_id: "p",
          created_at: "2026-01-01T00:00:00Z",
          has_password: true,
          email_verified: true,
        },
      },
      true,
    );
  }

  async function resolveSummary(unread_count: number) {
    mockedSummary.mockResolvedValueOnce({
      unread_count,
      tab_counts: {
        all: unread_count + 5,
        unread: unread_count,
        announcements: 3,
        reminders: 2,
        system: 0,
      },
    });
  }

  it("shows no badge when the unread count is zero", async () => {
    resolveSummary(0);
    renderWithProviders(<NotificationBell to="/notifications" />);
    await screen.findByRole("link");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the count for a small number of unread notifications", async () => {
    resolveSummary(3);
    renderWithProviders(<NotificationBell to="/notifications" />);
    await screen.findByText("٣"); // Intl.NumberFormat renders Arabic-Indic digits
    expect(screen.getByText(/غير مقروءة/)).toBeInTheDocument();
  });

  it("caps the visible badge at 99+", async () => {
    resolveSummary(150);
    renderWithProviders(<NotificationBell to="/notifications" />);
    await screen.findByText("99+");
  });

  it("issues no request for an anonymous visitor (D-4)", async () => {
    clearAuth();
    resolveSummary(1);
    renderWithProviders(<NotificationBell to="/notifications" />);
    // Give any accidental query a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockedSummary).not.toHaveBeenCalled();
  });
});
