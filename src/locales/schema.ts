import type {
  Achievement,
  BodyArea,
  CameraMode,
  CoachIdentity,
  ExerciseCard,
  FeedbackEvent,
  FeedbackMode,
  FeatureCard,
  HealthWidget,
  HighlightStat,
  HowItWorksStep,
  InsightCard,
  NavItem,
  PostureState,
  PrivacyPillar,
  ProblemCard,
  RatioPoint,
  ReminderPreset,
  SummaryCard,
  Testimonial,
  ThemeMode,
  TimelinePoint,
  TomorrowRecommendation,
  WeeklyTrendPoint,
} from "@/types/posture";

export type Language = "en" | "vi";
export type RecoveryFilter = "all" | BodyArea;

export interface ThemeOptionCopy {
  label: string;
  description: string;
}

export interface SittingBreakdownItem {
  label: string;
  minutes: number;
  fill: string;
}

export interface LanguageOption {
  value: Language;
  label: string;
  shortLabel: string;
}

export interface RecoveryFilterOption {
  value: RecoveryFilter;
  label: string;
}

export interface LocaleMessages {
  meta: {
    appName: string;
    tagline: string;
    loadingLabel: string;
    loadingTitle: string;
  };
  common: {
    languageToggleLabel: string;
    languageOptions: LanguageOption[];
    openMenuLabel: string;
    closeMenuLabel: string;
    navigationLabel: string;
    backToSiteLabel: string;
    themeCycleLabel: string;
    openSettingsLabel: string;
    avatarFallback: string;
    stateUnlocked: string;
    themeOptions: Record<ThemeMode, ThemeOptionCopy>;
    feedbackModeLabels: Record<FeedbackMode, string>;
    bodyAreaLabels: Record<BodyArea, string>;
    difficultyLabels: {
      easy: string;
      medium: string;
    };
    intensityLabels: {
      reset: string;
      "ease-in": string;
      build: string;
    };
  };
  nav: {
    marketing: NavItem[];
    app: NavItem[];
  };
  mobileNav: {
    landingTitle: string;
    productTitle: string;
    helperAnchor: string;
    helperRoute: string;
  };
  landing: {
    header: {
      previewReport: string;
      tryLiveDemo: string;
    };
    hero: {
      badge: string;
      title: string;
      titleHighlight: string;
      titleSuffix: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
      stats: HighlightStat[];
      preview: {
        coachingBadge: string;
        cameraOn: string;
        encouragementTitle: string;
        encouragementDetail: string;
        streakBadge: string;
        streakSuffix: string;
        privacyBadge: string;
        privacyTitle: string;
        privacyDescription: string;
        todayEyebrow: string;
      };
    };
    problem: {
      eyebrow: string;
      title: string;
      description: string;
      cards: ProblemCard[];
    };
    howItWorks: {
      eyebrow: string;
      title: string;
      description: string;
      steps: HowItWorksStep[];
    };
    features: {
      eyebrow: string;
      title: string;
      description: string;
      cards: FeatureCard[];
    };
    progress: {
      eyebrow: string;
      title: string;
      description: string;
      ringLabel: string;
      ringSubtitle: string;
      streakBadge: string;
      streakValue: string;
      streakDescription: string;
      trendBadge: string;
      trendValue: string;
      trendDescription: string;
      rewardsBadge: string;
      achievements: Achievement[];
      weeklyEyebrow: string;
      weeklyTitle: string;
      weeklyDescription: string;
      weeklyTrend: WeeklyTrendPoint[];
    };
    trust: {
      eyebrow: string;
      title: string;
      description: string;
      testimonials: Testimonial[];
      whyBadge: string;
      whyTitle: string;
      motivationsTitle: string;
      motivationsDescription: string;
      visibilityTitle: string;
      visibilityDescription: string;
    };
    privacy: {
      badge: string;
      title: string;
      description: string;
      snapshotTitle: string;
      snapshotItems: Array<{
        value: string;
        description: string;
      }>;
      eyebrow: string;
      surfaceTitle: string;
      surfaceDescription: string;
      pillars: PrivacyPillar[];
    };
    finalCta: {
      eyebrow: string;
      title: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
    };
    footer: {
      links: NavItem[];
    };
  };
  dashboard: {
    hero: {
      badge: string;
      title: string;
      description: string;
      scoreLabel: string;
      scoreValue: string;
      streakLabel: string;
      streakValue: string;
      settingsCta: string;
    };
    summary: SummaryCard[];
    monitor: {
      eyebrow: string;
      title: string;
      overlayBadge: string;
      coachingEyebrow: string;
      cameraOffTitle: string;
      analyzingCallout: string;
      trackingConfidenceLabel: string;
      trackingConfidenceValue: string;
    };
    coach: {
      noLiveScoreYet: string;
      liveScoreLabel: string;
      liveScoreOffSubtitle: string;
      liveScoreOnSubtitle: string;
      coachTipLabel: string;
      waitingTitle: string;
      waitingDescription: string;
      cooldownTitle: string;
      cooldownDescription: string;
      nextCueIn: string;
      nextCueTime: string;
      breakReminderBadge: string;
      breakReminderTitle: string;
      breakReminderDescription: string;
      achievementBadge: string;
      achievementTitle: string;
      achievementDescription: string;
    };
    demo: {
      eyebrow: string;
      title: string;
      tabs: {
        realtime: string;
        milestones: string;
      };
      cameraModeLabel: string;
      postureStateLabel: string;
      breakReminderLabel: string;
      breakReminderDescription: string;
      achievementLabel: string;
      achievementDescription: string;
    };
    feedbackHistory: {
      eyebrow: string;
      title: string;
      events: FeedbackEvent[];
    };
    health: {
      widgetsEyebrow: string;
      widgetsTitle: string;
      widgets: HealthWidget[];
      stretchEyebrow: string;
      stretchTitle: string;
      afterWarningLabel: string;
      previewFlowCta: string;
      stretches: ExerciseCard[];
    };
    analytics: {
      weeklyEyebrow: string;
      weeklyTitle: string;
      postureSeries: string;
      focusSeries: string;
      ratioEyebrow: string;
      ratioTitle: string;
      ratio: RatioPoint[];
      bestTimeLabel: string;
      bestTimeValue: string;
      needsSupportLabel: string;
      needsSupportValue: string;
      timelineEyebrow: string;
      timelineTitle: string;
      weeklyTrend: WeeklyTrendPoint[];
      timeline: TimelinePoint[];
    };
    rewards: {
      rewardsEyebrow: string;
      rewardsTitle: string;
      achievements: Achievement[];
      identityEyebrow: string;
      identityTitle: string;
      coachIdentity: CoachIdentity;
      specialtyLabel: string;
    };
  };
  report: {
    page: {
      badge: string;
      title: string;
      description: string;
      loadedCta: string;
      emptyCta: string;
    };
    overview: {
      scoreEyebrow: string;
      todayLabel: string;
      todayNote: string;
      deltaLabel: string;
      deltaNote: string;
      bestWindowLabel: string;
      recoveryMinutesLabel: string;
      ratioEyebrow: string;
      ratioTitle: string;
      ratio: RatioPoint[];
      sittingEyebrow: string;
      sittingTitle: string;
      sittingBreakdown: SittingBreakdownItem[];
      todayScore: number;
      deltaVsYesterday: number;
      bestWindow: string;
      recoveryMinutes: number;
    };
    insights: {
      insightsEyebrow: string;
      insightsTitle: string;
      cards: InsightCard[];
      tomorrowEyebrow: string;
      tomorrowTitle: string;
      recommendations: TomorrowRecommendation[];
    };
    noData: {
      eyebrow: string;
      title: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
      steps: string[];
    };
  };
  recovery: {
    page: {
      badge: string;
      title: string;
      description: string;
      unwindEyebrow: string;
      unwindTitle: string;
      unwindDescription: string;
      primaryCta: string;
      secondaryCta: string;
    };
    flow: {
      recommendedEyebrow: string;
      safetyEyebrow: string;
      stepLabel: string;
      remainingLabel: string;
      pauseCta: string;
      resumeCta: string;
      previousCta: string;
      nextCta: string;
      completeCta: string;
      cancelCta: string;
      completedTitle: string;
      completedDetail: string;
    };
    filters: RecoveryFilterOption[];
    cards: ExerciseCard[];
    afterWarningLabel: string;
    previewFlowCta: string;
  };
  settings: {
    page: {
      badge: string;
      title: string;
      description: string;
      snapshotLabel: string;
    };
    feedback: {
      sensitivityEyebrow: string;
      sensitivityTitle: string;
      sensitivityLabel: string;
      sensitivityDescription: string;
      sensitivityValueText: string;
      modeEyebrow: string;
      modeTitle: string;
      reminderEyebrow: string;
      reminderTitle: string;
      positiveEyebrow: string;
      positiveTitle: string;
      positiveDescription: string;
      themeEyebrow: string;
      themeTitle: string;
      reminderPresets: ReminderPreset[];
    };
    privacy: {
      explanationEyebrow: string;
      explanationTitle: string;
      explanationDescription: string;
      localProcessingLabel: string;
      localProcessingDescription: string;
      remindersLabel: string;
      remindersDescription: string;
      trustEyebrow: string;
      trustTitle: string;
      trustBullets: string[];
    };
  };
  demoStates: {
    posture: Record<
      PostureState,
      {
        label: string;
        headline: string;
        detail: string;
      }
    >;
    camera: Record<
      CameraMode,
      {
        label: string;
        description: string;
      }
    >;
  };
  wearable: {
    companion: {
      eyebrow: string;
      title: string;
      description: string;
      viewCta: string;
      postureStateLabel: string;
      activeZonesLabel: string;
      noActiveZonesLabel: string;
      disconnectedLabel: string;
      disconnectedDescription: string;
      disconnectedZonesLabel: string;
      correctionLabel: string;
      correctionDescription: string;
      tensionLabel: string;
      tensionDescription: string;
      loadLabel: string;
      noLoadLabel: string;
      disconnectedLoadLabel: string;
    };
    page: {
      badge: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaDashboard: string;
      rotateTip: string;
      zoneSelectLabel: string;
    };
    zones: {
      centerBack: { name: string; badge: string; description: string; detail: string };
      leftShoulder: { name: string; badge: string; description: string; detail: string };
      rightShoulder: { name: string; badge: string; description: string; detail: string };
      frontChest: { name: string; badge: string; description: string; detail: string };
    };
    productZones: {
      shoulderStraps: { name: string; badge: string; description: string; detail: string; activatesFor: string };
      coreModule: { name: string; badge: string; description: string; detail: string; activatesFor: string };
      frontStabilization: { name: string; badge: string; description: string; detail: string; activatesFor: string };
      adaptiveSupport: { name: string; badge: string; description: string; detail: string; activatesFor: string };
    };
    features: {
      eyebrow: string;
      title: string;
      description: string;
      items: Array<{ badge: string; title: string; description: string }>;
    };
    landing: {
      eyebrow: string;
      badge: string;
      title: string;
      titleHighlight: string;
      description: string;
      cta: string;
      secondaryCta: string;
      keyPoints: Array<{ title: string; description: string }>;
    };
    story: {
      eyebrow: string;
      steps: Array<{ title: string; description: string; metric: string }>;
    };
  };
}
