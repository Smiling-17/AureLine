import type { LocaleMessages } from "@/locales/schema";

export const enDemoStates: LocaleMessages["demoStates"] = {
  posture: {
    good: {
      label: "GOOD",
      headline: "Great alignment",
      detail: "Nice correction. Your shoulders are level and the neck angle is steady.",
    },
    warning: {
      label: "WARNING",
      headline: "Head drift detected",
      detail: "You are leaning slightly forward. Lift the screen or settle back into the chair.",
    },
    bad: {
      label: "BAD",
      headline: "Rounded back",
      detail: "Pause for a quick back reset and re-stack your head over your shoulders.",
    },
  },
  camera: {
    off: {
      label: "Camera off",
      description: "Preview the empty state before detection or permission is enabled.",
    },
    on: {
      label: "Camera on",
      description: "The live panel simulates realtime coaching with posture overlays and supportive feedback.",
    },
    analyzing: {
      label: "Analyzing",
      description: "Use this mode to review loading feedback while the system calibrates.",
    },
  },
};
