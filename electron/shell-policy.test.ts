import { describe, expect, it } from "vitest";
import { QUIT_FLUSH_FALLBACK_MS, shouldHideWindowToTray } from "./shell-policy";

describe("Electron shell policy", () => {
  it("only hides to tray while monitoring is active", () => {
    expect(shouldHideWindowToTray(true)).toBe(true);
    expect(shouldHideWindowToTray(false)).toBe(false);
  });

  it("keeps a bounded fallback for renderer quit acknowledgements", () => {
    expect(QUIT_FLUSH_FALLBACK_MS).toBeGreaterThanOrEqual(5_000);
  });
});
