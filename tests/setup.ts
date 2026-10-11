import { afterEach, vi } from "vitest";

Object.assign(process.env, {
  NODE_ENV: "test",
  TZ: "UTC",
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
