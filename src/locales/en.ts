import { enCommon } from "@/locales/content/en/common";
import { enDashboard } from "@/locales/content/en/dashboard";
import { enDemoStates } from "@/locales/content/en/demo";
import { enLanding } from "@/locales/content/en/landing";
import { enRecovery } from "@/locales/content/en/recovery";
import { enReport } from "@/locales/content/en/report";
import { enSettings } from "@/locales/content/en/settings";
import { enWearable } from "@/locales/content/en/wearable";
import type { LocaleMessages } from "@/locales/schema";

export const en: LocaleMessages = {
  ...enCommon,
  landing: enLanding,
  dashboard: enDashboard,
  report: enReport,
  recovery: enRecovery,
  settings: enSettings,
  demoStates: enDemoStates,
  wearable: enWearable,
};
