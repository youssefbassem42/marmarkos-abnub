import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { clearAuth, saveAuth } from "@/lib/auth";
import type { AnonymousMessageAdminItem } from "../../types";
import type { Paginated } from "@/modules/notifications/types";

vi.mock("@/modules/anonymous-messages/api", () => ({
  anonymousMessagesApi: {
    submit: vi.fn(),
    list: vi.fn(),
    retry: vi.fn(),
  },
}));

import { anonymousMessagesApi } from "@/modules/anonymous-messages/api";
import { AdminAnonymousMessagesPage } from "../AdminAnonymousMessagesPage";

const mockedList = vi.mocked(anonymousMessagesApi.list);
const mockedRetry = vi.mocked(anonymousMessagesApi.retry);

function makeItem(
  overrides: Partial<AnonymousMessageAdminItem>,
): AnonymousMessageAdminItem {
  return {
    id: overrides.id ?? "m1",
    message: "Please keep our family in your prayers this week.",
    sender_name: null,
    sender_phone: null,
    status: "SENT",
    telegram_status: "SENT",
    telegram_message_id: "9001",
    attempts: 1,
    failure_reason: null,
    created_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    last_attempt_at: null,
    ...overrides,
  };
}

function makePage(
  items: AnonymousMessageAdminItem[],
  pages = 1,
): Paginated<AnonymousMessageAdminItem> {
  return {
    items,
    total: items.length,
    page: 1,
    size: 20,
    pages,
    has_next: pages > 1,
  };
}

describe("AdminAnonymousMessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    signInAs("ADMIN");
  });

  function signInAs(role: "ADMIN" | "SERVANT") {
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
          role,
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

  function renderPage(
    initialEntries = ["/admin/anonymous-messages"],
  ): ReturnType<typeof render> {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <SidebarProvider>
              <AdminAnonymousMessagesPage />
            </SidebarProvider>
          </MemoryRouter>
        </LanguageProvider>
      </QueryClientProvider>,
    );
  }

  it("renders each row with the badge matching its status", async () => {
    mockedList.mockResolvedValueOnce(
      makePage([
        makeItem({ id: "m1", telegram_status: "SENT" }),
        makeItem({
          id: "m2",
          status: "FAILED",
          telegram_status: "FAILED",
          failure_reason: "timeout",
        }),
        makeItem({ id: "m3", status: "PENDING", telegram_status: "PENDING" }),
      ]),
    );
    renderPage();

    await screen.findAllByText(/Please keep our family/);
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("تم الإرسال").length).toBeGreaterThan(0);
    // Status + Telegram badges share labels; m2 is FAILED in both.
    expect(within(table).getAllByText("فشل").length).toBe(2);
    expect(within(table).getAllByText("قيد الانتظار").length).toBe(2);
  });

  it("offers retry only on FAILED rows and calls the API once", async () => {
    mockedRetry.mockResolvedValueOnce(
      makeItem({
        id: "m2",
        status: "SENT",
        telegram_status: "SENT",
        attempts: 2,
      }),
    );
    mockedList.mockResolvedValueOnce(
      makePage([
        makeItem({ id: "m1", telegram_status: "SENT" }),
        makeItem({
          id: "m2",
          status: "FAILED",
          telegram_status: "FAILED",
          failure_reason: "timeout",
        }),
      ]),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText(/Please keep our family/);
    const retryButtons = screen.getAllByRole("button", {
      name: /إعادة المحاولة/,
    });
    expect(retryButtons).toHaveLength(1); // only the FAILED row

    // The failure reason is reachable before retrying.
    expect(screen.getByText("timeout")).toBeInTheDocument();

    await user.click(retryButtons[0]);
    await waitFor(() => expect(mockedRetry).toHaveBeenCalledOnce());
    expect(mockedRetry).toHaveBeenCalledWith("m2");
  });

  it("refetches with the chosen status filter", async () => {
    mockedList.mockResolvedValue(makePage([]));
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /الكل/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: /تم الإرسال/ }),
    );

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ status: "SENT" }),
      ),
    );
  });

  it("renders the empty state when nothing matches", async () => {
    mockedList.mockResolvedValueOnce(makePage([]));
    renderPage();

    expect(await screen.findByText(/ستظهر هنا الرسائل/)).toBeInTheDocument();
  });
});
