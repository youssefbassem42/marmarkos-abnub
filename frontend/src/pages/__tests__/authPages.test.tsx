/**
 * The pages of the entrance of the platform.
 *
 * A visitor arrives here first: the landing page, the login, the
 * registration, the forgotten password. They were rendered by nobody
 * until now - a typo in a label, a form that does not validate, a link
 * that goes nowhere would have reached the members.
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/placeholder/PlaceholderPage";
import { LandingPage } from "@/pages/landing/LandingPage";
import { LoginPage } from "@/pages/auth/login/LoginPage";
import { RegisterPage } from "@/pages/auth/register/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/reset-password/ResetPasswordPage";
import { CheckEmailPage } from "@/pages/auth/verify-email/CheckEmailPage";
import { VerifyEmailResultPage } from "@/pages/auth/verify-email/VerifyEmailResultPage";
import { GoogleCallbackPage } from "@/pages/auth/google-callback/GoogleCallbackPage";

describe("the landing page", () => {
  it("welcomes the visitor and offers the entrance", async () => {
    renderPage(<LandingPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /إيمان/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText("إجتماع الشباب بأبنوب").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("link", { name: "تسجيل الدخول" }),
    ).toBeInTheDocument();
  });

  it("shows the sections of the page", async () => {
    renderPage(<LandingPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "نمو في الإيمان" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "صداقات حقيقية" }),
    ).toBeInTheDocument();
  });

  it("opens the page in Arabic", async () => {
    renderPage(<LandingPage />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute("dir")).toBe("rtl"),
    );
    expect(document.documentElement.getAttribute("lang")).toBe("ar");
  });
});

describe("the login page", () => {
  it("shows the two fields of the form", async () => {
    renderPage(<LoginPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    expect(screen.getByLabelText("كلمة المرور*")).toBeVisible();
    expect(screen.getByLabelText("تذكرني")).toBeInTheDocument();
  });

  it("welcomes the member who comes back", async () => {
    renderPage(<LoginPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "مرحبًا بعودتك!" }),
      ).toBeInTheDocument(),
    );
  });

  it("does not let the member send an empty form", async () => {
    renderPage(<LoginPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    // The button of an empty form is disabled - nothing is sent.
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeDisabled();
  });

  it("says that the address is not an address", async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    await user.type(
      screen.getByLabelText("البريد الإلكتروني*"),
      "not-an-email",
    );

    await waitFor(() =>
      expect(
        screen.getByText("يرجى إدخال بريد إلكتروني صحيح."),
      ).toBeInTheDocument(),
    );
  });

  it("opens the door when the form is complete", async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    await user.type(
      screen.getByLabelText("البريد الإلكتروني*"),
      "member@example.com",
    );
    await user.type(screen.getByLabelText("كلمة المرور*"), "secret-1234");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "تسجيل الدخول" }),
      ).toBeEnabled(),
    );
  });
});

describe("the registration page", () => {
  it("shows the fields of the registration", async () => {
    renderPage(<RegisterPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    expect(screen.getByLabelText("كلمة المرور*")).toBeVisible();
  });
});

describe("the forgotten password", () => {
  it("asks for the address of the member", async () => {
    renderPage(<ForgotPasswordPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("البريد الإلكتروني*")).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: /إرسال|استعادة/ }),
    ).toBeInTheDocument();
  });
});

describe("the reset of the password", () => {
  it("shows the new password and its confirmation", async () => {
    renderPage(<ResetPasswordPage />, { route: "/reset-password?token=abc" });

    await waitFor(() =>
      expect(screen.getAllByLabelText(/كلمة المرور/).length).toBeGreaterThan(0),
    );
  });
});

describe("the pages of the verification", () => {
  it("asks the member to open the mail", async () => {
    renderPage(<CheckEmailPage />);

    await waitFor(() => expect(screen.getByText(/البريد/)).toBeInTheDocument());
  });

  it("says that the link is invalid when there is no token", async () => {
    renderPage(<VerifyEmailResultPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /انتهت صلاحية الرابط/ }),
      ).toBeInTheDocument(),
    );
  });

  it("says that the link is invalid when the server refuses it", async () => {
    const { result } = renderPage(<VerifyEmailResultPage />, {
      route: "/verify-email/result?token=abc",
      answers: { "/auth/verify-email": { status: 400 } },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /انتهت صلاحية الرابط/ }),
      ).toBeInTheDocument(),
    );
    result.unmount();
  });

  it("says that Google is not configured when there is no token", async () => {
    renderPage(<GoogleCallbackPage />, {
      route: "/auth/google/callback#error=not_configured",
    });

    await waitFor(() =>
      expect(
        screen.getByText(/تسجيل الدخول عبر Google غير مُهيأ/),
      ).toBeInTheDocument(),
    );
  });

  it("waits for Google when the callback carries a token", async () => {
    renderPage(<GoogleCallbackPage />, {
      route: "/auth/google/callback#access_token=abc",
    });

    await waitFor(() =>
      expect(screen.getByText(/جارٍ إكمال تسجيل الدخول/)).toBeInTheDocument(),
    );
  });
});

describe("the pages of the end of the road", () => {
  it("says that the page does not exist - in Arabic", async () => {
    renderPage(<NotFoundPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "الصفحة غير موجودة" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "العودة إلى الرئيسية" }),
    ).toBeInTheDocument();
  });

  it("says that the member may not be here", async () => {
    renderPage(<ForbiddenPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "لا تملك صلاحية الوصول" }),
      ).toBeInTheDocument(),
    );
  });

  it("names the page that is not ready yet", async () => {
    renderPage(<PlaceholderPage titleKey="blog" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "المدونة" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/هذه الصفحة قيد الإنشاء/)).toBeInTheDocument();
  });
});
