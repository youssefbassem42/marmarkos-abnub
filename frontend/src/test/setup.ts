import "@testing-library/jest-dom/vitest";

// matchMedia stub: required by useIsMobile (and anything touching
// window.matchMedia) inside jsdom.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Real i18n resources so missing keys fail tests instead of rendering
// the key itself.
import i18n from "@/i18n";

await i18n.changeLanguage("ar");

// ResizeObserver stub: Radix Switch/popover content measures itself.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// IntersectionObserver stub: the landing page reveals its sections when
// they scroll into view. jsdom does not implement it.
//
// The stub behaves like a browser that shows the first screen of the page:
// every observed element counts as visible at once. A page that uses the
// `reveal` class without the observer of the landing page then reads as
// empty in the test - exactly as it reads in the browser.
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof window.IntersectionObserver;
}

// scrollIntoView stub: Radix (the select, the combobox) scrolls the
// chosen item into view. jsdom does not implement it.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
