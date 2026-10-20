import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement media playback and logs a "Not implemented" error
// whenever a <video> is played (e.g. the paper submission celebration).
// Stub it so tests stay quiet; individual tests can still spy on it.
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  writable: true,
  value: () => undefined,
});

afterEach(() => {
  cleanup();
});
