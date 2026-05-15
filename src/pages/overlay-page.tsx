import { useEffect, useState } from "react";
import { ShieldAlert, TimerReset } from "lucide-react";
import type { OverlayPayload } from "@/types/desktop-shell";
import { CyberButton } from "@/components/cyber/cyber-ui";

export function OverlayPage() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);

  useEffect(() => {
    if (!window.desktopShell) return;
    return window.desktopShell.overlay.onState(setPayload);
  }, []);

  return (
    <div
      className="grid min-h-screen place-items-center p-6 backdrop-blur-xl"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.14) 0%, transparent 60%), rgba(6,10,20,0.72)",
      }}
    >
      <div className="cyber-card-hero w-full max-w-2xl p-8 text-center">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl cyber-panel-red"
          style={{ animation: "pulse 2.4s ease-in-out infinite" }}
        >
          <ShieldAlert size={34} />
        </div>
        <p className="cyber-eyebrow mt-6" style={{ color: "var(--red)" }}>{payload?.levelLabel ?? "Level 4"}</p>
        <h1 className="t-display mt-3">{payload?.title ?? "Posture interruption"}</h1>
        <p className="t-body mx-auto mt-4 max-w-xl">
          {payload?.detail ?? "Return to a better posture to clear the overlay."}
        </p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          {payload?.issueLabel ?? "forward-head"}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <CyberButton
            onClick={() => {
              window.desktopShell?.overlay.openDashboard();
              window.desktopShell?.window.restore();
            }}
          >
            Open Dashboard
          </CyberButton>
          <CyberButton variant="secondary" onClick={() => window.desktopShell?.overlay.snooze()}>
            <TimerReset size={16} />
            Snooze 60s
          </CyberButton>
        </div>
      </div>
    </div>
  );
}
