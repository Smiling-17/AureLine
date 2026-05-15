import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useLanguage } from "@/components/shared/language-provider";
import { PostureRuntimeProvider } from "@/runtime/posture-runtime-provider";
import type { ThemeMode } from "@/types/posture";

const LandingPage = lazy(() =>
  import("@/pages/landing-page").then((module) => ({ default: module.LandingPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })),
);
const ReportPage = lazy(() =>
  import("@/pages/report-page").then((module) => ({ default: module.ReportPage })),
);
const ExercisesPage = lazy(() =>
  import("@/pages/exercises-page").then((module) => ({ default: module.ExercisesPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings-page").then((module) => ({ default: module.SettingsPage })),
);
const OverlayPage = lazy(() =>
  import("@/pages/overlay-page").then((module) => ({ default: module.OverlayPage })),
);
const WearablePage = lazy(() =>
  import("@/pages/wearable-page").then((module) => ({ default: module.WearablePage })),
);

export function App() {
  const [theme, setTheme] = useState<ThemeMode>("midnight");
  const [systemTheme, setSystemTheme] = useState<"midnight" | "pearl">("midnight");
  const { messages } = useLanguage();
  const isOverlayWindow = new URLSearchParams(window.location.search).get("window") === "overlay";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setSystemTheme(media.matches ? "pearl" : "midnight");

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, []);

  const resolvedTheme = useMemo(
    () => (theme === "system" ? systemTheme : theme),
    [systemTheme, theme],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const cycleTheme = () => {
    setTheme((current) => {
      if (current === "midnight") return "pearl";
      if (current === "pearl") return "system";
      return "midnight";
    });
  };

  if (isOverlayWindow) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[rgba(6,17,31,0.52)] px-6">
            <div className="cyber-card px-8 py-6 text-center">
              <p className="cyber-eyebrow">{messages.meta.loadingLabel}</p>
              <p className="mt-3 text-2xl font-semibold">{messages.meta.loadingTitle}</p>
            </div>
          </div>
        }
      >
        <OverlayPage />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="cyber-card px-8 py-6 text-center">
            <p className="cyber-eyebrow">{messages.meta.loadingLabel}</p>
            <p className="mt-3 text-2xl font-semibold">{messages.meta.loadingTitle}</p>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/overlay" element={<OverlayPage />} />
        <Route
          path="*"
          element={
            <PostureRuntimeProvider>
              <Routes>
                <Route
                  path="/"
                  element={<LandingPage theme={theme} resolvedTheme={resolvedTheme} onThemeCycle={cycleTheme} />}
                />
                <Route
                  path="/dashboard"
                  element={
                    <DashboardPage
                      theme={theme}
                      resolvedTheme={resolvedTheme}
                      onThemeCycle={cycleTheme}
                    />
                  }
                />
                <Route
                  path="/report"
                  element={<ReportPage theme={theme} resolvedTheme={resolvedTheme} onThemeCycle={cycleTheme} />}
                />
                <Route
                  path="/recovery"
                  element={<ExercisesPage theme={theme} resolvedTheme={resolvedTheme} onThemeCycle={cycleTheme} />}
                />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      theme={theme}
                      resolvedTheme={resolvedTheme}
                      onThemeCycle={cycleTheme}
                      onThemeChange={setTheme}
                    />
                  }
                />
                <Route
                  path="/wearable"
                  element={
                    <WearablePage
                      theme={theme}
                      resolvedTheme={resolvedTheme}
                      onThemeCycle={cycleTheme}
                    />
                  }
                />
              </Routes>
            </PostureRuntimeProvider>
          }
        />
      </Routes>
    </Suspense>
  );
}
