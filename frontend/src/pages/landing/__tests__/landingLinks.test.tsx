/**
 * The inventory of the links of the landing page.
 *
 * Every button of the landing page must go somewhere real: a route of
 * the platform (react-router) or a section of the page that exists.
 * No <a href="#">, no <button> without an action.
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { router } from "@/router";
import { LandingPage } from "@/pages/landing/LandingPage";

const knownPaths = new Set<string>(
  router.routes
    .flatMap((route) => [
      route.path,
      ...(route.children ?? []).map((child) => child.path),
    ])
    .filter((path): path is string => typeof path === "string"),
);

function renderLanding() {
  return renderPage(<LandingPage />);
}

describe("the links of the landing page", () => {
  it("has every link point to a route the router knows, or to a section of the page", () => {
    renderLanding();

    const ids = new Set(
      [...document.querySelectorAll("[id]")].map((element) => element.id),
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";

      // External links: they leave the platform, they open in a new tab
      // and they never die.
      if (href.startsWith("http")) {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link.getAttribute("rel") ?? "").toContain("noopener");
        continue;
      }
      if (href.startsWith("mailto:")) continue;

      expect(href, "a link without an address").not.toMatch(/^#?$/);

      const [pathname, hash] = href.split("#");
      if (pathname) {
        expect(
          knownPaths.has(pathname),
          `the link ${href} points at a route the router does not know`,
        ).toBe(true);
      }
      if (hash) {
        expect(
          ids.has(hash),
          `the link ${href} points at a section that does not exist`,
        ).toBe(true);
      }
    }
  });

  it("keeps Facebook only in the social part of the footer", () => {
    renderLanding();

    const social = screen.getAllByRole("link", { name: /فيسبوك/ });
    expect(social).toHaveLength(2);
    for (const link of social) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(
      screen.queryByRole("link", { name: /إنستغرام|إنستجرام/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /يوتيوب|YouTube/i }),
    ).not.toBeInTheDocument();
  });

  it("has no dead anchor on the landing page", () => {
    renderLanding();

    expect(
      screen.queryByRole("link", { name: /معرض الصور/ }),
    ).not.toBeInTheDocument();
    const anchors = screen.getAllByRole("link");
    for (const anchor of anchors) {
      expect(anchor.getAttribute("href")).not.toBe("#");
    }
  });
});
