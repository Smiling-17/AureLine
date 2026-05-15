import { en } from "@/locales/en";
import { vi } from "@/locales/vi";
import type { Language, LocaleMessages } from "@/locales/schema";

export const localeMessages: Record<Language, LocaleMessages> = {
  en,
  vi,
};

export type { Language, LocaleMessages, RecoveryFilter } from "@/locales/schema";
