import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";

vi.mock("@/modules/anonymous-messages/api", () => ({
  anonymousMessagesApi: {
    submit: vi.fn(),
    list: vi.fn(),
    retry: vi.fn(),
  },
}));
vi.mock("@/modules/notifications/api", () => ({
  notificationsApi: {
    summary: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    push: vi.fn(),
  },
}));

import { anonymousMessagesApi } from "@/modules/anonymous-messages/api";
import { notificationsApi } from "@/modules/notifications/api";
import { AnonymousMessagePage } from "../AnonymousMessagePage";
import { ApiError } from "@/lib/api";

const mockedSubmit = vi.mocked(anonymousMessagesApi.submit);
const mockedList = vi.mocked(anonymousMessagesApi.list);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>
          <AnonymousMessagePage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

const MESSAGE_LABEL = "رسالتك";
const SUBMIT = /إرسال الرسالة/;

describe("AnonymousMessagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  async function typeMessage(
    user: ReturnType<typeof userEvent.setup>,
    text: string,
  ) {
    await user.type(screen.getByLabelText(MESSAGE_LABEL), text);
  }

  it("blocks a nine-character message and passes ten", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockResolvedValueOnce({
      id: "n1",
      status: "SENT",
      delivered: true,
    });
    renderPage();

    await typeMessage(user, "123456789");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockedSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(MESSAGE_LABEL));
    await typeMessage(user, "1234567890");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledOnce());
  });

  it("shows a live counter that turns red past the limit", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("0 / 1000")).toBeInTheDocument();
    await typeMessage(user, "hello");
    expect(screen.getByText("5 / 1000")).toBeInTheDocument();

    const longText = "x".repeat(1001);
    // Typing 1001 characters one by one is slow; set the value in one go.
    const textarea = screen.getByLabelText(
      MESSAGE_LABEL,
    ) as HTMLTextAreaElement;
    await user.clear(textarea);
    fireEvent.change(textarea, { target: { value: longText } });

    await waitFor(() =>
      expect(screen.getByText("1001 / 1000")).toBeInTheDocument(),
    );
    const counter = screen.getByText("1001 / 1000");
    expect(counter.className).toContain("text-brand-red");
    expect(screen.getByRole("button", { name: SUBMIT })).toBeDisabled();
  });

  it("accepts an empty optional phone but rejects an invalid one", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockResolvedValueOnce({
      id: "n2",
      status: "SENT",
      delivered: true,
    });
    renderPage();

    await typeMessage(user, "A message with plenty of characters.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledOnce());

    // Second run: invalid phone blocks.
    await user.click(screen.getByRole("button", { name: /إرسال رسالة أخرى/ }));
    await typeMessage(user, "Another message with enough text.");
    await user.type(screen.getByLabelText(/رقم الهاتف/), "abc");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/رقم هاتف صحيحًا/)).toBeInTheDocument();
    expect(mockedSubmit).toHaveBeenCalledOnce();
  });

  it("shows the success state even when Telegram delivery failed (BR-13)", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockResolvedValueOnce({
      id: "n3",
      status: "FAILED",
      delivered: false,
    });
    renderPage();

    await typeMessage(user, "Please pray for my family tonight.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText("تم استلام رسالتك")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: SUBMIT }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /إرسال رسالة أخرى/ }));
    expect(screen.getByRole("button", { name: SUBMIT })).toBeInTheDocument();
  });

  it("surfaces the rate-limit message on a 429", async () => {
    const user = userEvent.setup();
    mockedSubmit.mockRejectedValueOnce(
      new ApiError(
        429,
        "Too many messages. Please try again later",
        "rate_limited",
      ),
    );
    renderPage();

    await typeMessage(user, "One more prayer request for today.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/عدة رسائل بالفعل/)).toBeInTheDocument();
  });

  it("renders for an anonymous visitor and issues no reads", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "رسالة مجهولة" }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockedList).not.toHaveBeenCalled();
    expect(notificationsApi.summary).not.toHaveBeenCalled();
  });
});
