import "@testing-library/jest-dom";

// Most suites run in jsdom, but a few opt into the node environment with
// "@vitest-environment node" — home-visit.sql-conflicts.test.ts runs Postgres
// in-process, which jsdom cannot host. There is no window to patch there, so
// the DOM mocks below are applied only when one exists.
const hasDom = typeof window !== "undefined";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (hasDom) Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

if (hasDom) Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (hasDom) Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});
