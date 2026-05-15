import type { LocaleMessages } from "@/locales/schema";

export const enReport: LocaleMessages["report"] = {
  page: {
    badge: "Daily report",
    title: "Turn posture data into a calm, motivating daily summary.",
    description:
      "Review the polished loaded state or switch to the graceful no-data view.",
    loadedCta: "Loaded report",
    emptyCta: "No data yet",
  },
  overview: {
    scoreEyebrow: "Score overview",
    todayLabel: "Today",
    todayNote: "Steadier, calmer, moving up.",
    deltaLabel: "Vs yesterday",
    deltaNote: "You corrected faster after warning cues.",
    bestWindowLabel: "Best window",
    recoveryMinutesLabel: "Recovery minutes",
    ratioEyebrow: "Posture ratio",
    ratioTitle: "Good posture dominated most sessions",
    ratio: [
      { name: "Good", value: 58, fill: "#34d399" },
      { name: "Warning", value: 28, fill: "#fb923c" },
      { name: "Bad", value: 14, fill: "#f87171" },
    ],
    sittingEyebrow: "Sitting breakdown",
    sittingTitle: "How your workday was distributed",
    sittingBreakdown: [
      { label: "Focused sitting", minutes: 168, fill: "#7dd3fc" },
      { label: "Recovery breaks", minutes: 41, fill: "#34d399" },
      { label: "Warning windows", minutes: 34, fill: "#fb923c" },
      { label: "Bad posture time", minutes: 17, fill: "#f87171" },
    ],
    todayScore: 84,
    deltaVsYesterday: 6,
    bestWindow: "2:00 PM - 4:00 PM",
    recoveryMinutes: 11,
  },
  insights: {
    insightsEyebrow: "Personalized insights",
    insightsTitle: "What stood out today",
    cards: [
      {
        title: "Best window",
        description: "Your posture stayed strongest after lunch when your screen height was adjusted.",
        stat: "91 avg score",
      },
      {
        title: "Watch this habit",
        description: "Forward head posture still appears first when you switch from notes to keyboard.",
        stat: "3 warning spikes",
      },
      {
        title: "You are improving",
        description: "Correction speed is up, so the coaching loop is starting to stick.",
        stat: "18 sec average",
      },
    ],
    tomorrowEyebrow: "Tomorrow recommendations",
    tomorrowTitle: "Simple moves to keep the trend going",
    recommendations: [
      {
        title: "Raise your laptop by 4 cm",
        description: "A slightly higher screen angle should reduce the first morning warning.",
        time: "Before 9:00 AM",
      },
      {
        title: "Schedule a stretch reset after 45 minutes",
        description: "That is where shoulder tension begins to climb most often.",
        time: "10:45 AM",
      },
      {
        title: "Keep the supportive voice cue",
        description: "It improved your correction speed without breaking focus.",
        time: "All day",
      },
    ],
  },
  noData: {
    eyebrow: "No data yet",
    title: "Reports come alive after a few guided sessions.",
    description:
      "This empty state is part of the MVP too. It reassures the user, explains what unlocks next, and gives a clear path back into the live coaching experience.",
    primaryCta: "Start a live session",
    secondaryCta: "Explore recovery routines",
    steps: [
      "Collect your first posture session",
      "Let the app compare your patterns",
      "Unlock tomorrow recommendations",
    ],
  },
};
