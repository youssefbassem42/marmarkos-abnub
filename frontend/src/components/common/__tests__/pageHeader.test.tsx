/**
 * The shared header of a page: the title, the description, the actions
 * and the way back.
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { PageHeader } from "@/components/common/PageHeader";

describe("PageHeader", () => {
  it("shows the title, the description and the actions", () => {
    const actions = <button type="button">تعديل الملف الشخصي</button>;
    renderPage(
      <PageHeader
        title="الملف الشخصي"
        description="عرض نقاطك وتعديل بياناتك."
        actions={actions}
      />,
    );

    expect(screen.getByText("الملف الشخصي")).toBeInTheDocument();
    expect(screen.getByText("عرض نقاطك وتعديل بياناتك.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "تعديل الملف الشخصي" }),
    ).toBeInTheDocument();
  });

  it("hides the description when there is none", () => {
    renderPage(<PageHeader title="الرئيسية" backTo="/" />);

    expect(screen.queryAllByRole("paragraph")).toEqual([]);
  });

  it("renders the way back as a link that points to the route", () => {
    renderPage(<PageHeader title="الملف الشخصي" backTo="/points" />, {
      route: "/profile",
    });

    const link = screen.getByRole("link", { name: "رجوع" });

    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/points");
  });

  it("gives the way back an accessible name", () => {
    renderPage(
      <PageHeader
        title="الملف الشخصي"
        backTo="/points"
        backLabel="العودة للوراء"
      />,
    );

    expect(
      screen.getByRole("link", { name: "العودة للوراء" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "رجوع" }),
    ).not.toBeInTheDocument();
  });

  it("is the first element that the keyboard reaches", () => {
    const actions = <button type="button">إضافة</button>;
    renderPage(
      <PageHeader title="الملف الشخصي" backTo="/points" actions={actions} />,
    );

    const focusable = document.querySelectorAll<HTMLElement>("a[href], button");
    const link = screen.getByRole("link", { name: "رجوع" });

    expect([...focusable][0]).toBe(link);
  });

  it("renders no way back when there is no route", () => {
    renderPage(<PageHeader title="الرئيسية" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "الرئيسية",
    );
  });

  it("renders a long title without crashing", () => {
    renderPage(
      <PageHeader title="عنوانطويلجدابدونمسافات عنوانطويلجدابدونمسافات" />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
