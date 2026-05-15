export interface OverlayPayload {
  title: string;
  detail: string;
  issueLabel: string;
  levelLabel: string;
  muted?: boolean;
}

export type DesktopAction =
  | { type: "restore" }
  | { type: "quit" }
  | { type: "overlay-snooze"; until: number }
  | { type: "overlay-open-dashboard" };

export interface DesktopShellApi {
  overlay: {
    show: (payload: OverlayPayload) => void;
    hide: () => void;
    snooze: () => void;
    openDashboard: () => void;
    onState: (listener: (payload: OverlayPayload | null) => void) => () => void;
  };
  tray: {
    onAction: (listener: (action: DesktopAction) => void) => () => void;
  };
  window: {
    restore: () => void;
    setMonitoringActive: (active: boolean) => void;
    notifyQuitReady: () => void;
  };
}

declare global {
  interface Window {
    desktopShell?: DesktopShellApi;
  }
}

export {};
