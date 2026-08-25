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
