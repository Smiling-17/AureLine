export const TRACKING_LOST_GRACE_MS = 1500;

export function safeFrameDelta(previousTimestamp: number | null, currentTimestamp: number, maxDeltaMs = TRACKING_LOST_GRACE_MS) {
  if (previousTimestamp === null) return 0;

  const delta = currentTimestamp - previousTimestamp;
  if (delta <= 0 || delta > maxDeltaMs) return 0;
  return delta;
}

export function isFrameGapTooLarge(previousTimestamp: number | null, currentTimestamp: number, maxDeltaMs = TRACKING_LOST_GRACE_MS) {
  return previousTimestamp !== null && currentTimestamp - previousTimestamp > maxDeltaMs;
}
