export const QUIT_FLUSH_FALLBACK_MS = 10_000;

export function shouldHideWindowToTray(monitoringActive: boolean) {
  return monitoringActive;
}
