import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
} from "electron";
import { QUIT_FLUSH_FALLBACK_MS, shouldHideWindowToTray } from "./shell-policy.js";

type OverlayPayload = {
  title: string;
  detail: string;
  issueLabel: string;
  levelLabel: string;
  muted?: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let quitInProgress = false;
let monitoringActive = false;
let quitFallbackTimer: NodeJS.Timeout | null = null;
let overlayState: OverlayPayload | null = null;

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7dd3fc"/>
          <stop offset="100%" stop-color="#34d399"/>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#g)"/>
      <circle cx="16" cy="10" r="3" fill="#06111f"/>
      <path d="M16 13 L16 22 M10 16 L22 16 M12 24 L20 24" stroke="#06111f" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

type RendererWindowRole = "main" | "overlay";

function getRendererUrl(hashPath = "/dashboard", role: RendererWindowRole = "main") {
  if (process.env.VITE_DEV_SERVER_URL) {
    const url = new URL(process.env.VITE_DEV_SERVER_URL);
    url.searchParams.set("window", role);
    url.hash = hashPath;
    return url.toString();
  }

  const url = pathToFileURL(path.join(__dirname, "../dist/index.html"));
  url.searchParams.set("window", role);
  url.hash = hashPath;
  return url.toString();
}

function restoreMainWindow() {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function finalizeQuit() {
  if (quitFallbackTimer) {
    clearTimeout(quitFallbackTimer);
    quitFallbackTimer = null;
  }

  quitting = true;
  overlayWindow?.destroy();
  mainWindow?.destroy();
  app.quit();
}

function requestQuit() {
  if (quitInProgress) return;

  quitInProgress = true;
  quitting = true;
  hideOverlay();

  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcastTrayAction({ type: "quit" });
    quitFallbackTimer = setTimeout(finalizeQuit, QUIT_FLUSH_FALLBACK_MS);
    return;
  }

  finalizeQuit();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: "AI Posture Coach",
    autoHideMenuBar: true,
    backgroundColor: "#06111f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  void mainWindow.loadURL(getRendererUrl("/dashboard", "main"));

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  (mainWindow as BrowserWindow & NodeJS.EventEmitter).on("minimize", (event: Electron.Event) => {
    if (shouldHideWindowToTray(monitoringActive)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("close", (event) => {
    if (quitting) {
      return;
    }

    if (shouldHideWindowToTray(monitoringActive)) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    event.preventDefault();
    requestQuit();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function ensureOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: true,
    show: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    backgroundColor: "#00000066",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });

  try {
    overlayWindow.setBackgroundMaterial("acrylic");
  } catch {
    // Fallback to dim overlay on unsupported Windows versions.
  }

  void overlayWindow.loadURL(getRendererUrl("/overlay", "overlay"));

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function broadcastTrayAction(action: { type: "restore" | "quit" | "overlay-snooze" | "overlay-open-dashboard"; until?: number }) {
  mainWindow?.webContents.send("desktop-shell:tray-action", action);
}

function positionOverlayWindow() {
  if (!overlayWindow) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  overlayWindow.setBounds(display.bounds);
}

function showOverlay(payload: OverlayPayload) {
  overlayState = payload;
  const window = ensureOverlayWindow();
  positionOverlayWindow();

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", () => {
      window.webContents.send("desktop-shell:overlay-state", overlayState);
    });
  } else {
    window.webContents.send("desktop-shell:overlay-state", overlayState);
  }

  window.showInactive();
}

function hideOverlay() {
  overlayState = null;
  overlayWindow?.hide();
  overlayWindow?.webContents.send("desktop-shell:overlay-state", null);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("AI Posture Coach");
  tray.on("double-click", () => {
    restoreMainWindow();
    broadcastTrayAction({ type: "restore" });
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => {
        restoreMainWindow();
        broadcastTrayAction({ type: "restore" });
      },
    },
    {
      label: "Quit",
      click: () => {
        requestQuit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function registerIpc() {
  ipcMain.on("desktop-shell:overlay-show", (_event, payload: OverlayPayload) => {
    showOverlay(payload);
  });

  ipcMain.on("desktop-shell:overlay-hide", () => {
    hideOverlay();
  });

  ipcMain.on("desktop-shell:window-restore", () => {
    restoreMainWindow();
    broadcastTrayAction({ type: "restore" });
  });

  ipcMain.on("desktop-shell:overlay-snooze", () => {
    const until = Date.now() + 60_000;
    hideOverlay();
    broadcastTrayAction({ type: "overlay-snooze", until });
  });

  ipcMain.on("desktop-shell:overlay-open-dashboard", () => {
    restoreMainWindow();
    hideOverlay();
    broadcastTrayAction({ type: "overlay-open-dashboard" });
  });

  ipcMain.on("desktop-shell:monitoring-active", (_event, active: boolean) => {
    monitoringActive = active;
  });

  ipcMain.on("desktop-shell:quit-ready", () => {
    finalizeQuit();
  });

  ipcMain.handle("desktop-shell:overlay-current-state", () => overlayState);
}

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      restoreMainWindow();
    }
  });
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep app alive in tray until explicit quit.
  }
});
