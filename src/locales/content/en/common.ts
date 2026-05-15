import type { LocaleMessages } from "@/locales/schema";

export const enCommon: Pick<LocaleMessages, "meta" | "common" | "nav" | "mobileNav"> = {
  meta: {
    appName: "Aureline",
    tagline: "Posture / Alignment / AI",
    loadingLabel: "Aureline",
    loadingTitle: "Loading the experience",
  },
  common: {
    languageToggleLabel: "Select language",
    languageOptions: [
      { value: "en", label: "English", shortLabel: "EN" },
      { value: "vi", label: "Vietnamese", shortLabel: "VI" },
    ],
    openMenuLabel: "Open navigation menu",
    closeMenuLabel: "Close navigation menu",
    navigationLabel: "Navigation",
    backToSiteLabel: "Back to site",
    themeCycleLabel: "Cycle theme",
    openSettingsLabel: "Open settings",
    avatarFallback: "AI",
    stateUnlocked: "Unlocked",
    themeOptions: {
      midnight: {
        label: "Midnight",
        description: "Deep contrast with restrained glow.",
      },
      pearl: {
        label: "Pearl",
        description: "Clean light surfaces with calm depth.",
      },
      system: {
        label: "System",
        description: "Follows system preference automatically.",
      },
    },
    feedbackModeLabels: {
      gentle: "Gentle visual",
      sound: "Soft sound",
      voice: "Supportive voice",
    },
    bodyAreaLabels: {
      neck: "Neck",
      shoulders: "Shoulders",
      back: "Back",
      hips: "Hips",
    },
    difficultyLabels: {
      easy: "Easy",
      medium: "Medium",
    },
    intensityLabels: {
      reset: "Reset",
      "ease-in": "Ease in",
      build: "Build",
    },
  },
  nav: {
    marketing: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Progress", href: "#progress" },
      { label: "Privacy", href: "#privacy" },
    ],
    app: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Daily report", href: "/report" },
      { label: "Recovery", href: "/recovery" },
      { label: "Settings", href: "/settings" },
    ],
  },
  mobileNav: {
    landingTitle: "Explore the landing story",
    productTitle: "Move through the product",
    helperAnchor:
      "Move through the landing story with the same structure as desktop, optimized for touch and keyboard.",
    helperRoute:
      "Move through the demo with the same navigation structure as desktop, optimized for touch and keyboard.",
  },
};
