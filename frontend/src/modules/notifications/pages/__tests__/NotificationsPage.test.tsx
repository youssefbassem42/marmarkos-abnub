import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { clearAuth, saveAuth } from "@/lib/auth";
import type { NotificationItem, Paginated } from "../../types";

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
import { NotificationsPage } from "../NotificationsPage";

const mockedList = vi.mocked(notificationsApi.list);
const mockedSummary = vi.mocked(notificationsApi.summary);
const mockedMarkAll = vi.mocked(notificationsApi.markAllRead);

function makeItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: overrides.id ?? "n1",
    type: "BLOG_POST",
    title_ar: "منشور جديد",
    title_en: "New post",
    message_ar: "اقرأه الآن",
    message_en: "Read it now",
    data: null,
    is_read: false,
    is_broadcast: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makePage(
  items: NotificationItem[],
  pages = 1,
): Paginated<NotificationItem> {
  return {
    items,
    total: items.length,
    page: 1,
    size: 20,
    pages,
    has_next: pages > 1,
  };
}

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

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAuth();
    signIn();
    mockedSummary.mockResolvedValue({
      unread_count: 2,
      tab_counts: {
        all: 7,
        unread: 2,
        announcements: 3,
        reminders: 2,
        system: 0,
      },
    });
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.invalidateQueries = vi.fn(queryClient.invalidateQueries);
    const view = render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <MemoryRouter>
            <NotificationsPage />
          </MemoryRouter>
        </LanguageProvider>
      </QueryClientProvider>,
    );
    return { ...view, queryClient };
  }

  it("renders feed rows with the type accent and marks them readable", async () => {
    mockedList.mockResolvedValueOnce(
      makePage([
        makeItem({ type: "ANNOUNCEMENT", title_ar: "إعلان عام" }),
        makeItem({
          type: "ATTENDANCE",
          title_ar: "تم تسجيل الحضور",
          is_read: true,
        }),
      ]),
    );
    renderPage();

    await screen.findByText("إعلان عام");
    expect(screen.getByText("تم تسجيل الحضور")).toBeInTheDocument();
    // Frozen accent map: ANNOUNCEMENT → border-mint (§3.5).
    expect(document.querySelector(".border-mint")).not.toBeNull();
    expect(document.querySelector(".border-brand-orange")).not.toBeNull();
  });

  it("switches to the Unread tab and refetches with tab=unread", async () => {
    mockedList.mockResolvedValue(makePage([]));
    renderPage();

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("tab", { name: /غير المقروءة/ }));

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "unread" }),
      ),
    );
  });

  it("fires mark-all-read and invalidates the module cache", async () => {
    mockedMarkAll.mockResolvedValueOnce({ marked: 2 });
    mockedList.mockResolvedValue(makePage([makeItem({})]));
    const { queryClient } = renderPage();

    const button = await screen.findByRole("button", {
      name: /تحديد الكل كمقروء/,
    });
    await userEvent.click(button);

    await waitFor(() => expect(mockedMarkAll).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["notifications"],
      }),
    );
  });

  it("shows the empty state when the feed has no rows", async () => {
    mockedList.mockResolvedValueOnce(makePage([]));
    renderPage();

    expect(await screen.findByText(/ستظهر هنا الإعلانات/)).toBeInTheDocument();
  });

  it("offers a retry when the feed fails to load", async () => {
    mockedList.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /حاول مرة تاني/ }),
    ).toBeInTheDocument();
  });

  it("shows the pager only when there is more than one page", async () => {
    mockedList.mockResolvedValueOnce(makePage([makeItem({})], 1));
    const first = renderPage();
    await first.findByText("منشور جديد");
    expect(
      within(first.getByRole("main")).queryByRole("navigation"),
    ).toBeNull();
    first.unmount();

    mockedList.mockResolvedValueOnce(makePage([makeItem({ id: "n9" })], 3));
    const second = renderPage();
    await second.findByText("منشور جديد");
    expect(
      within(second.getByRole("main")).getByRole("navigation"),
    ).toBeInTheDocument();
  });
});
