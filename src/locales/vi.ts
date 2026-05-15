import { viCommon } from "@/locales/content/vi/common";
import { viDashboard } from "@/locales/content/vi/dashboard";
import { viDemoStates } from "@/locales/content/vi/demo";
import { viLanding } from "@/locales/content/vi/landing";
import { viRecovery } from "@/locales/content/vi/recovery";
import { viReport } from "@/locales/content/vi/report";
import { viSettings } from "@/locales/content/vi/settings";
import { viWearable } from "@/locales/content/vi/wearable";
import type { LocaleMessages } from "@/locales/schema";

export const vi: LocaleMessages = {
  ...viCommon,
  landing: viLanding,
  dashboard: viDashboard,
  report: viReport,
  recovery: viRecovery,
  settings: viSettings,
  demoStates: viDemoStates,
  wearable: viWearable,
};
