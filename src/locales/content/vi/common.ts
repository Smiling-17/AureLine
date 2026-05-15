import type { LocaleMessages } from "@/locales/schema";

export const viCommon: Pick<LocaleMessages, "meta" | "common" | "nav" | "mobileNav"> = {
  meta: {
    appName: "Aureline",
    tagline: "Posture / Alignment / AI",
    loadingLabel: "Aureline",
    loadingTitle: "\u0110ang t\u1ea3i tr\u1ea3i nghi\u1ec7m",
  },
  common: {
    languageToggleLabel: "Ch\u1ecdn ng\u00f4n ng\u1eef",
    languageOptions: [
      { value: "en", label: "Ti\u1ebfng Anh", shortLabel: "EN" },
      { value: "vi", label: "Ti\u1ebfng Vi\u1ec7t", shortLabel: "VI" },
    ],
    openMenuLabel: "M\u1edf menu \u0111i\u1ec1u h\u01b0\u1edbng",
    closeMenuLabel: "\u0110\u00f3ng menu \u0111i\u1ec1u h\u01b0\u1edbng",
    navigationLabel: "\u0110i\u1ec1u h\u01b0\u1edbng",
    backToSiteLabel: "V\u1ec1 landing",
    themeCycleLabel: "Chuy\u1ec3n giao di\u1ec7n",
    openSettingsLabel: "M\u1edf c\u00e0i \u0111\u1eb7t",
    avatarFallback: "AI",
    stateUnlocked: "\u0110\u00e3 m\u1edf",
    themeOptions: {
      midnight: {
        label: "Midnight",
        description: "T\u01b0\u01a1ng ph\u1ea3n s\u00e2u, \u0111i\u1ec3m nh\u1ea5n s\u00e1ng v\u1eeba \u0111\u1ee7.",
      },
      pearl: {
        label: "Pearl",
        description: "B\u1ec1 m\u1eb7t s\u00e1ng s\u1ea1ch, v\u1eabn gi\u1eef chi\u1ec1u s\u00e2u d\u1ecbu m\u1eaft.",
      },
      system: {
        label: "Theo m\u00e1y",
        description: "T\u1ef1 \u0111\u1ed3ng b\u1ed9 theo giao di\u1ec7n h\u1ec7 th\u1ed1ng.",
      },
    },
    feedbackModeLabels: {
      gentle: "Nh\u1eafc nh\u1eb9 b\u1eb1ng h\u00ecnh \u1ea3nh",
      sound: "\u00c2m b\u00e1o nh\u1eb9",
      voice: "Gi\u1ecdng nh\u1eafc h\u1ed7 tr\u1ee3",
    },
    bodyAreaLabels: {
      neck: "C\u1ed5",
      shoulders: "Vai",
      back: "L\u01b0ng",
      hips: "H\u00f4ng",
    },
    difficultyLabels: {
      easy: "D\u1ec5",
      medium: "V\u1eeba",
    },
    intensityLabels: {
      reset: "Th\u1ea3 l\u1ecfng",
      "ease-in": "L\u00e0m quen",
      build: "T\u0103ng d\u1ea7n",
    },
  },
  nav: {
    marketing: [
      { label: "C\u00e1ch ho\u1ea1t \u0111\u1ed9ng", href: "#how-it-works" },
      { label: "T\u00ednh n\u0103ng", href: "#features" },
      { label: "Ti\u1ebfn b\u1ed9", href: "#progress" },
      { label: "Ri\u00eang t\u01b0", href: "#privacy" },
    ],
    app: [
      { label: "T\u1ed5ng quan", href: "/dashboard" },
      { label: "B\u00e1o c\u00e1o ng\u00e0y", href: "/report" },
      { label: "Ph\u1ee5c h\u1ed3i", href: "/recovery" },
      { label: "C\u00e0i \u0111\u1eb7t", href: "/settings" },
    ],
  },
  mobileNav: {
    landingTitle: "Kh\u00e1m ph\u00e1 c\u00e2u chuy\u1ec7n s\u1ea3n ph\u1ea9m",
    productTitle: "\u0110i nhanh qua to\u00e0n b\u1ed9 s\u1ea3n ph\u1ea9m",
    helperAnchor:
      "B\u1ea1n c\u00f3 th\u1ec3 l\u01b0\u1edbt c\u00e1c ph\u1ea7n ch\u00ednh tr\u00ean landing page b\u1eb1ng c\u00f9ng c\u1ea5u tr\u00fac \u0111i\u1ec1u h\u01b0\u1edbng nh\u01b0 b\u1ea3n desktop, t\u1ed1i \u01b0u cho c\u1ea3m \u1ee9ng v\u00e0 b\u00e0n ph\u00edm.",
    helperRoute:
      "B\u1ea1n c\u00f3 th\u1ec3 \u0111i qua to\u00e0n b\u1ed9 demo v\u1edbi c\u00f9ng c\u1ea5u tr\u00fac \u0111i\u1ec1u h\u01b0\u1edbng nh\u01b0 b\u1ea3n desktop, t\u1ed1i \u01b0u cho c\u1ea3m \u1ee9ng v\u00e0 b\u00e0n ph\u00edm.",
  },
};
