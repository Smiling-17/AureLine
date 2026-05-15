import { describe, expect, it } from "vitest";
import { safeFrameDelta, TRACKING_LOST_GRACE_MS } from "@/runtime/time";

describe("runtime time helpers", () => {
  it("keeps normal frame deltas and drops negative or oversized gaps", () => {
    expect(safeFrameDelta(null, 1000)).toBe(0);
    expect(safeFrameDelta(1000, 1100)).toBe(100);
    expect(safeFrameDelta(1100, 1000)).toBe(0);
    expect(safeFrameDelta(1000, 1000 + TRACKING_LOST_GRACE_MS + 1)).toBe(0);
  });
});
