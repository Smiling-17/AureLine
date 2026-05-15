import type { LocaleMessages } from "@/locales/schema";

export const enSettings: LocaleMessages["settings"] = {
  page: {
    badge: "Settings and privacy",
    title: "Let users tune the coach until it feels supportive, safe, and personal.",
    description:
      "This page packages sensitivity, feedback mode, reminders, privacy explanation, local processing trust, and theme selection into one premium control center.",
    snapshotLabel: "Live preference snapshot",
  },
  feedback: {
    sensitivityEyebrow: "Feedback sensitivity",
    sensitivityTitle: "Dial in how proactive the coach feels",
    sensitivityLabel: "Sensitivity",
    sensitivityDescription: "Higher values make the coach speak up sooner when posture starts drifting.",
    sensitivityValueText: "out of 100 sensitivity",
    modeEyebrow: "Feedback mode",
    modeTitle: "Choose how the app speaks up",
    reminderEyebrow: "Reminder interval",
    reminderTitle: "Space cues around real work rhythms",
    positiveEyebrow: "Positive reinforcement",
    positiveTitle: "Achievement and celebration cues",
    positiveDescription: "Keep small moments of delight active when the user earns them.",
    themeEyebrow: "Theme settings",
    themeTitle: "Choose the atmosphere of the product",
    reminderPresets: [
      { label: "Focused reset", minutes: 45 },
      { label: "Balanced rhythm", minutes: 50 },
      { label: "Deep work", minutes: 60 },
    ],
  },
  privacy: {
    explanationEyebrow: "Privacy explanation",
    explanationTitle: "Trust is explained in human language",
    explanationDescription:
      "AI Posture Coach is positioned as privacy-first. This settings surface shows how local processing, adjustable reminders, and clearly named controls help the app feel respectful rather than invasive.",
    localProcessingLabel: "Local processing mode",
    localProcessingDescription:
      "Keep posture analysis framed as staying on-device whenever the real pipeline is connected later.",
    remindersLabel: "Reminders active",
    remindersDescription:
      "Users can pause reminders any time without losing progress or trust in the product.",
    trustEyebrow: "Local processing trust section",
    trustTitle: "What users should feel here",
    trustBullets: [
      "This product respects my space.",
      "I can control how often it nudges me.",
      "It is helping me improve, not judging me.",
    ],
  },
};
