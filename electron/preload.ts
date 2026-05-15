import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type DesktopAction =
  | { type: "restore" }
  | { type: "quit" }
  | { type: "overlay-snooze"; until: number }
  | { type: "overlay-open-dashboard" };

type OverlayPayload = {
  title: string;
  detail: string;
  issueLabel: string;
  levelLabel: string;
  muted?: boolean;
};

const desktopShell = {
  overlay: {
    show: (payload: OverlayPayload) => ipcRenderer.send("desktop-shell:overlay-show", payload),
    hide: () => ipcRenderer.send("desktop-shell:overlay-hide"),
    snooze: () => ipcRenderer.send("desktop-shell:overlay-snooze"),
    openDashboard: () => ipcRenderer.send("desktop-shell:overlay-open-dashboard"),
    onState: (listener: (payload: OverlayPayload | null) => void) => {
      const handler = (_event: IpcRendererEvent, payload: OverlayPayload | null) => listener(payload);
      ipcRenderer.on("desktop-shell:overlay-state", handler);
      ipcRenderer.invoke("desktop-shell:overlay-current-state").then(listener).catch(() => {
        listener(null);
      });

      return () => ipcRenderer.removeListener("desktop-shell:overlay-state", handler);
    },
  },
  tray: {
    onAction: (listener: (action: DesktopAction) => void) => {
      const handler = (_event: IpcRendererEvent, action: DesktopAction) => listener(action);
      ipcRenderer.on("desktop-shell:tray-action", handler);

      return () => ipcRenderer.removeListener("desktop-shell:tray-action", handler);
    },
  },
  window: {
    restore: () => ipcRenderer.send("desktop-shell:window-restore"),
    setMonitoringActive: (active: boolean) => ipcRenderer.send("desktop-shell:monitoring-active", active),
    notifyQuitReady: () => ipcRenderer.send("desktop-shell:quit-ready"),
  },
};

contextBridge.exposeInMainWorld("desktopShell", desktopShell);
