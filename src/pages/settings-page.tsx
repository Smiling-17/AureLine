import {
  Bell,
  Camera,
  Lock,
  Monitor,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/shared/language-provider";
import {
  CyberButton,
  CyberCard,
  CyberShell,
  CyberToggle,
  MetricTile,
  SparkBar,
} from "@/components/cyber/cyber-ui";
import { usePostureRuntime } from "@/runtime/posture-runtime-provider";
import type { FeedbackMode, ThemeMode } from "@/types/posture";
import type { LandmarkPolicy } from "@/runtime/types";

interface SettingsPageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}

function SettingRow({
  icon,
  title,
  subtitle,
  children,
  tone = "cyan",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: "cyan" | "mint" | "violet" | "amber" | "red";
}) {
  return (
    <div className="settings-row">
      <div className={`settings-row-icon cyber-tone-${tone}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <h3 className="t-heading-sm">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      <div className="min-w-[110px]">{children}</div>
    </div>
  );
}

export function SettingsPage({
  theme,
  resolvedTheme,
  onThemeCycle,
  onThemeChange,
}: SettingsPageProps) {
  const { messages, language } = useLanguage();
  const {
    cameraDevices,
    preferences,
    refreshCameraDevices,
    selectedCameraLabel,
    updatePreferences,
  } = usePostureRuntime();
  const feedbackLabel = messages.common.feedbackModeLabels[preferences.feedbackMode];
  const feedbackModes: FeedbackMode[] = ["gentle", "sound", "voice"];
  const themes: ThemeMode[] = ["midnight", "pearl", "system"];

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cyber-eyebrow">{messages.settings.page.badge}</p>
          <h1 className="t-display mt-2">{messages.settings.page.title}</h1>
        </div>
        <MetricTile
          label={messages.settings.page.snapshotLabel}
          value={feedbackLabel}
          detail={`${preferences.reminderMinutes}m`}
          tone="cyan"
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="grid gap-4">
          <CyberCard className="p-5">
            <p className="cyber-eyebrow">{messages.settings.feedback.sensitivityEyebrow}</p>
            <h2 className="mt-2 t-heading-lg">{messages.settings.feedback.sensitivityTitle}</h2>
            <div className="mt-5 rounded-2xl cyber-panel-cyan p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-sm font-semibold">{messages.settings.feedback.sensitivityLabel}</span>
                <strong className="text-[var(--cyan)]">{preferences.sensitivity}</strong>
              </div>
              <input
                className="cyber-range"
                type="range"
                min={0}
                max={100}
                value={preferences.sensitivity}
                onChange={(event) => updatePreferences({ sensitivity: Number(event.target.value) })}
                aria-label={messages.settings.feedback.sensitivityLabel}
              />
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{messages.settings.feedback.sensitivityDescription}</p>
            </div>
          </CyberCard>

          <CyberCard className="p-5">
            <p className="cyber-eyebrow">{messages.settings.feedback.modeEyebrow}</p>
            <h2 className="mt-2 t-heading-lg">{messages.settings.feedback.modeTitle}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {feedbackModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={preferences.feedbackMode === mode}
                  onClick={() => updatePreferences({ feedbackMode: mode })}
                  className={`rounded-2xl p-4 text-left cyber-selection-card ${
                    preferences.feedbackMode === mode ? "is-active cyber-tone-cyan" : ""
                  }`}
                >
                  <Volume2 size={18} className="mb-3" />
                  <strong className="text-sm font-semibold">{messages.common.feedbackModeLabels[mode]}</strong>
                </button>
              ))}
            </div>
          </CyberCard>

          <CyberCard className="p-5">
            <p className="cyber-eyebrow">{messages.settings.feedback.reminderEyebrow}</p>
            <h2 className="mt-2 t-heading-lg">{messages.settings.feedback.reminderTitle}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {messages.settings.feedback.reminderPresets.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  aria-pressed={preferences.reminderMinutes === preset.minutes}
                  onClick={() => updatePreferences({ reminderMinutes: preset.minutes })}
                  className={`rounded-2xl p-4 text-left cyber-selection-card ${
                    preferences.reminderMinutes === preset.minutes ? "is-active cyber-tone-violet" : ""
                  }`}
                >
                  <ClockIcon />
                  <strong className="text-sm font-semibold">{preset.label}</strong>
                  <span className="mt-2 block text-xs">{preset.minutes}m</span>
                </button>
              ))}
            </div>
          </CyberCard>

          <CyberCard className="p-5">
            <p className="cyber-eyebrow">{messages.settings.feedback.themeEyebrow}</p>
            <h2 className="mt-2 t-heading-lg">{messages.settings.feedback.themeTitle}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {themes.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => onThemeChange(value)}
                  className={`rounded-2xl p-4 text-left cyber-selection-card ${
                    theme === value ? "is-active cyber-tone-mint" : ""
                  }`}
                >
                  <Sparkles size={18} className="mb-3" />
                  <strong className="text-sm font-semibold">{messages.common.themeOptions[value].label}</strong>
                  <p className="mt-2 text-xs leading-5">{messages.common.themeOptions[value].description}</p>
                </button>
              ))}
            </div>
          </CyberCard>
        </div>

        <div className="grid gap-4 xl:self-start">
          <CyberCard className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="cyber-eyebrow">{language === "vi" ? "Nguồn camera" : "Camera source"}</p>
                <h2 className="mt-2 t-heading-lg">{selectedCameraLabel ?? (language === "vi" ? "Camera mặc định" : "Default camera")}</h2>
              </div>
              <CyberButton variant="ghost" onClick={() => void refreshCameraDevices()}>
                <RefreshCw size={15} />
              </CyberButton>
            </div>
            <SettingRow
              icon={<Camera size={17} />}
              title={language === "vi" ? "Chọn webcam" : "Choose webcam"}
              subtitle={language === "vi" ? "Dùng khi máy chọn sai camera ảo hoặc camera màn hình." : "Use this when the app picks a virtual or screen camera."}
              tone="cyan"
            >
              <select
                className="cyber-select"
                value={preferences.cameraDeviceId ?? ""}
                onChange={(event) => updatePreferences({ cameraDeviceId: event.target.value || undefined })}
              >
                <option value="">{language === "vi" ? "Mặc định" : "Default"}</option>
                {cameraDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </SettingRow>
            <SettingRow
              icon={<Monitor size={17} />}
              title={language === "vi" ? "Chế độ landmark" : "Landmark mode"}
              subtitle={language === "vi" ? "Relaxed phù hợp với webcam laptop; Strict cần thấy hông rõ hơn." : "Relaxed fits laptop webcams; Strict keeps torso metrics when hips are visible."}
              tone="violet"
            >
              <select
                className="cyber-select"
                value={preferences.landmarkPolicy}
                onChange={(event) => updatePreferences({ landmarkPolicy: event.target.value as LandmarkPolicy })}
              >
                <option value="relaxed">Relaxed</option>
                <option value="strict">Strict</option>
              </select>
            </SettingRow>
          </CyberCard>

          <CyberCard className="p-5">
            <p className="cyber-eyebrow">{messages.settings.feedback.positiveEyebrow}</p>
            <SettingRow
              icon={<Sparkles size={17} />}
              title={messages.settings.feedback.positiveTitle}
              subtitle={messages.settings.feedback.positiveDescription}
              tone="mint"
            >
              <CyberToggle
                checked={preferences.microCelebrations}
                onChange={(microCelebrations) => updatePreferences({ microCelebrations })}
                label={messages.settings.feedback.positiveTitle}
                tone="mint"
              />
            </SettingRow>
            <SettingRow
              icon={<Bell size={17} />}
              title={messages.settings.privacy.remindersLabel}
              subtitle={messages.settings.privacy.remindersDescription}
              tone="amber"
            >
              <CyberToggle
                checked={preferences.remindersEnabled}
                onChange={(remindersEnabled) => updatePreferences({ remindersEnabled })}
                label={messages.settings.privacy.remindersLabel}
                tone="amber"
              />
            </SettingRow>
          </CyberCard>

          <CyberCard tone="mint" className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="text-[var(--mint)]" size={20} />
              <p className="cyber-eyebrow">{messages.settings.privacy.explanationEyebrow}</p>
            </div>
            <h2 className="t-heading-lg">{messages.settings.privacy.explanationTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{messages.settings.privacy.explanationDescription}</p>
            <div className="mt-5">
              <SettingRow
                icon={<Lock size={17} />}
                title={messages.settings.privacy.localProcessingLabel}
                subtitle={messages.settings.privacy.localProcessingDescription}
                tone="mint"
              >
                <CyberToggle
                  checked={preferences.localProcessing}
                  onChange={(localProcessing) => updatePreferences({ localProcessing })}
                  label={messages.settings.privacy.localProcessingLabel}
                  tone="mint"
                />
              </SettingRow>
            </div>
            <div className="mt-5 space-y-3">
              {messages.settings.privacy.trustBullets.map((item, index) => (
                <div key={item}>
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span>{item}</span>
                    <span className="text-[var(--mint)]">{index === 0 ? 100 : index === 1 ? 84 : 72}%</span>
                  </div>
                  <SparkBar value={index === 0 ? 100 : index === 1 ? 84 : 72} tone="mint" />
                </div>
              ))}
            </div>
          </CyberCard>
        </div>
      </section>
    </CyberShell>
  );
}

function ClockIcon() {
  return <SlidersHorizontal size={18} className="mb-3" />;
}
