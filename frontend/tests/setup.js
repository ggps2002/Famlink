import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// React Testing Library does not unmount between tests on its own when
// `globals: false`, and a left-mounted tree keeps its effects and timers
// running into the next test.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom implements neither of these, and both are called during mount by
// components this app renders — the share carousels and the sticky headers.
// Unstubbed, they throw before a single assertion runs.
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Ant Design reads this on mount for its responsive breakpoints.
global.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});

// `scrollTo` is called by the router's scroll-restoration and by several
// onboarding steps. jsdom leaves it undefined rather than a no-op.
global.scrollTo ??= () => {};
