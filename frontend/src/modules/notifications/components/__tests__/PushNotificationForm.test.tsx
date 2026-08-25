import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { clearAuth, saveAuth } from "@/lib/auth";

vi.mock("@/modules/notifications/api", () => ({
  notificationsApi: {
    summary: vi.fn().mockResolvedValue({
      unread_count: 0,
      tab_counts: {
        all: 0,
        unread: 0,
        announcements: 0,
        reminders: 0,
        system: 0,
      },
    }),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    push: vi.fn(),
  },
}));

import { notificationsApi } from "@/modules/notifications/api";
import { PushNotificationForm } from "../PushNotificationForm";
import { AdminNotificationsPage } from "@/modules/notifications/pages/AdminNotificationsPage";

const mockedPush = vi.mocked(notificationsApi.push);

function renderWithProviders(ui: ReactElement, initialEntries = ["/"]) {
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

function signInAs(role: "ADMIN" | "SERVANT" | "MEMBER") {
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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("العنوان (بالعربية)"), "عنوان الإعلان");
  await user.type(
    screen.getByLabelText("العنوان (بالإنجليزية)"),
    "Announcement title",
  );
  await user.type(
    screen.getByLabelText("الرسالة (بالعربية)"),
    "نص الرسالة بالعربية هنا",
  );
  await user.type(
    screen.getByLabelText("الرسالة (بالإنجليزية)"),
    "The English message body here",
  );
}

describe("PushNotificationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAuth();
    signInAs("ADMIN");
  });

  it("blocks submit when the Arabic title is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PushNotificationForm />);

    await user.click(screen.getByRole("button", { name: /إرسال إلى الجميع/ }));

    expect(mockedPush).not.toHaveBeenCalled();
  });

  it("blocks submit when a message is only two characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PushNotificationForm />);

    await user.type(screen.getByLabelText("العنوان (بالعربية)"), "عنوان طويل");
    await user.type(
      screen.getByLabelText("العنوان (بالإنجليزية)"),
      "A long title",
    );
    await user.type(screen.getByLabelText("الرسالة (بالعربية)"), "ab");
    await user.type(
      screen.getByLabelText("الرسالة (بالإنجليزية)"),
      "The English body",
    );
    await user.click(screen.getByRole("button", { name: /إرسال إلى الجميع/ }));

    expect(mockedPush).not.toHaveBeenCalled();
    expect(await screen.findAllByText(/بالعربية/)).not.toHaveLength(0);
  });

  it("blocks submit when the optional CTA URL is malformed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PushNotificationForm />);

    await fillValidForm(user);
    await user.type(screen.getByLabelText("رابط (اختياري)"), "not-a-url");
    await user.click(screen.getByRole("button", { name: /إرسال إلى الجميع/ }));

    expect(mockedPush).not.toHaveBeenCalled();
  });

  it("sends without a dialog when the email switch is off", async () => {
    const user = userEvent.setup();
    mockedPush.mockResolvedValueOnce({
      notification_id: "n1",
      recipients: 0,
      emails_sent: 0,
      emails_failed: 0,
    });
    renderWithProviders(<PushNotificationForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /إرسال إلى الجميع/ }));

    await waitFor(() => expect(mockedPush).toHaveBeenCalledOnce());
    expect(mockedPush).toHaveBeenCalledWith(
      expect.objectContaining({ send_email: false }),
    );
    // Frozen DTO field names on the wire (plan §3.7).
    const payload = mockedPush.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "cta_url",
      "message_ar",
      "message_en",
      "send_email",
      "title_ar",
      "title_en",
    ]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirms by dialog before emailing, then sends with send_email", async () => {
    const user = userEvent.setup();
    mockedPush.mockResolvedValueOnce({
      notification_id: "n1",
      recipients: 3,
      emails_sent: 3,
      emails_failed: 0,
    });
    renderWithProviders(<PushNotificationForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole("switch", { name: /بالبريد الإلكتروني/ }),
    );
    await user.click(screen.getByRole("button", { name: /إرسال إلى الجميع/ }));

    // Dialog first: nothing sent yet (R-1).
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(mockedPush).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "إرسال" }));
    await waitFor(() => expect(mockedPush).toHaveBeenCalledOnce());
    expect(mockedPush).toHaveBeenCalledWith(
      expect.objectContaining({ send_email: true }),
    );
  });
});

describe("AdminNotificationsPage gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAuth();
  });

  it("hides the composer from a SERVANT", async () => {
    signInAs("SERVANT");
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
      has_next: false,
    });

    renderWithProviders(
      <SidebarProvider>
        <AdminNotificationsPage />
      </SidebarProvider>,
      ["/admin/notifications"],
    );

    expect(
      await screen.findByText("راجع الإعلانات وأرسل إشعارًا جديدًا."),
    ).toBeInTheDocument();
    expect(screen.queryByText("إرسال إعلان")).not.toBeInTheDocument();
  });

  it("shows the composer for an ADMIN", async () => {
    signInAs("ADMIN");
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
      has_next: false,
    });

    renderWithProviders(
      <SidebarProvider>
        <AdminNotificationsPage />
      </SidebarProvider>,
      ["/admin/notifications"],
    );

    expect(await screen.findByText("إرسال إعلان")).toBeInTheDocument();
  });
});
