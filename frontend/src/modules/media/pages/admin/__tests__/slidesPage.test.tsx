import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { clearAuth, saveAuth } from "@/lib/auth";
import type { LandingSlideAdminItem } from "../../../types";

vi.mock("@/modules/media/api", () => ({
  mediaApi: {
    getAdminSlides: vi.fn(),
    createSlide: vi.fn(),
    updateSlide: vi.fn(),
    deleteSlide: vi.fn(),
    reorderSlides: vi.fn(),
  },
}));

import { mediaApi } from "@/modules/media/api";
import { SlidesPage } from "../SlidesPage";

const mockedGet = vi.mocked(mediaApi.getAdminSlides);
const mockedCreate = vi.mocked(mediaApi.createSlide);

const SLIDE: LandingSlideAdminItem = {
  id: "s1",
  image: "https://example.com/slide1.jpg",
  title: "العنوان الأول",
  subtitle: "وصف أول",
  order: 1,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PAGE = {
  items: [SLIDE],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

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

function renderSlidesPage(
  initialEntries = ["/admin/landing/slides"],
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <SidebarProvider>
            <SlidesPage />
          </SidebarProvider>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("the management of the landing slides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    signInAsAdmin();
    mockedGet.mockResolvedValue(PAGE);
  });

  it("lists the slides in a table", async () => {
    renderSlidesPage();

    await waitFor(() =>
      expect(screen.getAllByText("العنوان الأول").length).toBeGreaterThan(0),
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("العنوان الأول")).toBeInTheDocument();
    expect(within(table).getByText(/^1$/)).toBeInTheDocument();
    // The active switch.
    expect(
      within(table).getByRole("switch", {
        name: /إلغاء التفعيل/,
      }),
    ).toBeChecked();
  });

  it("opens the form, adds a slide and calls the creation endpoint", async () => {
    mockedCreate.mockResolvedValue({
      ...SLIDE,
      id: "s2",
    });
    const user = userEvent.setup();
    renderSlidesPage();

    await screen.findByText("العنوان الأول");
    await user.click(screen.getByRole("button", { name: /إضافة شريحة/ }));

    const title = screen.getByLabelText(/^العنوان$/);
    await user.clear(title);
    await user.type(title, "عنوان جديد");
    await user.click(screen.getByRole("button", { name: /تأكيد/ }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const formData = mockedCreate.mock.calls[0][0] as FormData;
    expect(formData.get("title")).toBe("عنوان جديد");
    expect(formData.get("file")).toBeNull();
  });

  it("shows the error state when the list fails", async () => {
    mockedGet.mockRejectedValue(new Error("boom"));
    renderSlidesPage();

    expect(
      await screen.findByRole("button", { name: /حاول مرة تاني/ }),
    ).toBeInTheDocument();
  });
});
