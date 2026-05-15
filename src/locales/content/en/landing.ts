import type { LocaleMessages } from "@/locales/schema";

export const enLanding: LocaleMessages["landing"] = {
  header: {
    previewReport: "Preview report",
    tryLiveDemo: "Try the live demo",
  },
  hero: {
    badge: "Realtime coaching for healthier workdays",
    title: "A personal",
    titleHighlight: "AI posture coach",
    titleSuffix: "that helps you improve every day.",
    description:
      "Turn posture into a visible, motivating habit with live coaching, streaks, progress analytics, and privacy-first trust built directly into the experience.",
    primaryCta: "Launch the dashboard",
    secondaryCta: "Explore daily reports",
    stats: [
      {
        label: "Alignment score",
        value: "92",
        caption: "Live score that feels like a coach, not a chart.",
      },
      {
        label: "Weekly streak",
        value: "13 days",
        caption: "Healthy posture momentum that keeps compounding.",
      },
      {
        label: "Improvement",
        value: "+12%",
        caption: "Better than last week with gentle nudges and recovery.",
      },
    ],
    preview: {
      coachingBadge: "Live coaching",
      cameraOn: "Camera on",
      encouragementTitle: "Great alignment",
      encouragementDetail: "Nice correction. You settled your shoulders and kept the neck angle steady.",
      streakBadge: "Streak building",
      streakSuffix: "days with a reset done right",
      privacyBadge: "Privacy first",
      privacyTitle: "Built to feel safe on day one",
      privacyDescription:
        "Local processing and clear controls sit beside coaching, not buried in settings.",
      todayEyebrow: "Today at a glance",
    },
  },
  problem: {
    eyebrow: "The gap",
    title: "Most people do not need more discipline. They need posture to become easier to notice.",
    description:
      "AI Posture Coach is framed as a behavior-change product, so the interface highlights awareness, timing, and recovery instead of fear-based warnings.",
    cards: [
      {
        title: "Hours disappear in one posture",
        description: "Study sessions and coding sprints pull your head forward before you even notice.",
        metric: "2.6 hrs avg before first slump",
      },
      {
        title: "Pain builds quietly",
        description: "Neck, shoulders, and lower back tension show up after the work is already done.",
        metric: "3 hot zones tracked",
      },
      {
        title: "Habits need reinforcement",
        description: "A single reminder is easy to ignore. A smart cadence makes change stick.",
        metric: "Micro-feedback every 18 mins",
      },
    ],
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "A gentle loop of visibility, coaching, and daily reinforcement.",
    description: "Every touchpoint is designed to feel useful in the moment and motivating over the week.",
    steps: [
      {
        title: "Watch your posture in real time",
        description: "A live coaching surface turns posture into something visible and easy to correct.",
        accent: "Realtime confidence",
      },
      {
        title: "Coach with supportive nudges",
        description:
          "Feedback arrives with the right intensity: celebrate wins, redirect gently, suggest breaks when needed.",
        accent: "Behavior-first",
      },
      {
        title: "Build healthier habits over time",
        description: "Reports, streaks, and recovery routines make progress feel tangible every day.",
        accent: "Habit loop",
      },
    ],
  },
  features: {
    eyebrow: "Feature system",
    title: "Designed to feel premium, expressive, and launch-ready.",
    description:
      "The demo already includes the UI surfaces needed for product reviews, pitching, user tests, and future integration work.",
    cards: [
      {
        eyebrow: "Live monitor",
        title: "Mock camera coaching with clear posture states",
        description: "Preview GOOD, WARNING, BAD, and ANALYZING moments before the real detection layer exists.",
      },
      {
        eyebrow: "Progress engine",
        title: "Score rings, timeline views, and weekly analytics",
        description: "Show improvement visually so the product already feels credible in demos and user tests.",
      },
      {
        eyebrow: "Delight loop",
        title: "Refined streaks, achievements, and identity cues",
        description: "Gamification feels premium and motivating instead of childish or noisy.",
      },
      {
        eyebrow: "Trust by design",
        title: "Privacy language built into the core flow",
        description:
          "Explain local processing and control surfaces in the same place users expect to feel safe.",
      },
      {
        eyebrow: "Daily reports",
        title: "Summaries that stay useful even before real data is fully wired",
        description:
          "Loaded and empty states both feel product-ready, so reviews never fall into a dead-end screen.",
      },
    ],
  },
  progress: {
    eyebrow: "Progress loop",
    title: "Consistency looks rewarding without becoming childish.",
    description:
      "Streaks, achievements, and weekly movement create just enough delight to make better posture feel sticky.",
    ringLabel: "Posture score",
    ringSubtitle: "You're improving",
    streakBadge: "Streak",
    streakValue: "13 days",
    streakDescription: "Nice correction habits are holding through longer focus sessions.",
    trendBadge: "Trend",
    trendValue: "+12%",
    trendDescription: "Better than last week after spacing reminders more intelligently.",
    rewardsBadge: "Identity rewards",
    achievements: [
      {
        title: "Desk Reset Streak",
        description: "Completed 5 setup corrections this week.",
        progress: 100,
        unlocked: true,
      },
      {
        title: "Shoulder Saver",
        description: "Keep shoulder tension low for three sessions in a row.",
        progress: 74,
        unlocked: false,
      },
      {
        title: "Evening Finisher",
        description: "End the day above 80 without skipping recovery.",
        progress: 90,
        unlocked: false,
      },
    ],
    weeklyEyebrow: "Weekly rhythm",
    weeklyTitle: "A chart language that already feels product-real.",
    weeklyDescription: "Clean analytics presentation helps this MVP demo look ready for stakeholder feedback.",
    weeklyTrend: [
      { day: "Mon", posture: 72, focus: 78, breaks: 2 },
      { day: "Tue", posture: 74, focus: 80, breaks: 3 },
      { day: "Wed", posture: 79, focus: 84, breaks: 3 },
      { day: "Thu", posture: 83, focus: 86, breaks: 4 },
      { day: "Fri", posture: 86, focus: 88, breaks: 4 },
      { day: "Sat", posture: 81, focus: 76, breaks: 3 },
      { day: "Sun", posture: 88, focus: 82, breaks: 4 },
    ],
  },
  trust: {
    eyebrow: "Trust signals",
    title: "Supportive language, believable outcomes, and product confidence.",
    description:
      "The landing narrative feels credible because it shows how posture coaching fits into real routines for students and professionals.",
    testimonials: [
      {
        quote: "It feels like a polished wellness product, not another stern productivity tool.",
        name: "Lina Tran",
        role: "Architecture student",
        improvement: "Neck strain down after late-night study blocks",
      },
      {
        quote: "The live posture panel made me want to fix my setup immediately.",
        name: "Noah Patel",
        role: "Frontend engineer",
        improvement: "Posture score up 12% week over week",
      },
      {
        quote: "I trust it because the privacy message is clear before I even click settings.",
        name: "Maya Chen",
        role: "Operations analyst",
        improvement: "Break habit became consistent in 9 days",
      },
    ],
    whyBadge: "Why it resonates",
    whyTitle: "It feels like a daily coach, not a lecture.",
    motivationsTitle: "Motivation stays positive",
    motivationsDescription:
      "Copy celebrates progress and encourages small corrections instead of using fear-heavy language.",
    visibilityTitle: "Trust is visible early",
    visibilityDescription:
      "Privacy and control surfaces appear before the user is asked to commit, which lowers hesitation immediately.",
  },
  privacy: {
    badge: "Privacy by design",
    title: "Coaching that feels personal without feeling invasive.",
    description:
      "The UI explains local processing, adjustable feedback, and respectful defaults in simple language so the product feels trustworthy from the start.",
    snapshotTitle: "Trust snapshot",
    snapshotItems: [
      {
        value: "100%",
        description: "Camera messaging visible before onboarding friction.",
      },
      {
        value: "3",
        description: "Layers of control for feedback sensitivity, reminders, and theme preference.",
      },
    ],
    eyebrow: "Privacy surface",
    surfaceTitle: "Trust is not an afterthought card hidden in settings.",
    surfaceDescription:
      "It is a product pillar, so the demo gives it the same visual weight as progress and coaching.",
    pillars: [
      {
        title: "Local-first positioning",
        description: "The interface explains that video can stay on-device and under the user's control.",
      },
      {
        title: "Adjustable feedback",
        description: "Sensitivity, reminder intervals, and coaching style can be tuned without digging.",
      },
      {
        title: "Respectful language",
        description: "Copy is supportive and non-medical so the app feels caring rather than invasive.",
      },
    ],
  },
  finalCta: {
    eyebrow: "Final CTA",
    title: "Start with a launch-style demo that already feels like a product people want to use.",
    description:
      "Explore the live dashboard, browse the report, preview recovery routines, and inspect privacy settings without any backend or AI plumbing yet.",
    primaryCta: "Open the dashboard",
    secondaryCta: "Review privacy controls",
  },
  footer: {
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Daily report", href: "/report" },
      { label: "Recovery", href: "/recovery" },
      { label: "Settings", href: "/settings" },
    ],
  },
};
