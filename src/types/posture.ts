export type ThemeMode = "midnight" | "pearl" | "system";
export type CameraMode = "off" | "on" | "analyzing";
export type PostureState = "good" | "warning" | "bad";
export type FeedbackMode = "voice" | "sound" | "gentle";
export type BodyArea = "neck" | "shoulders" | "back" | "hips";
export type ExerciseIntensity = "reset" | "ease-in" | "build";
export type ExerciseDifficulty = "easy" | "medium";

export interface NavItem {
  label: string;
  href: string;
}

export interface HighlightStat {
  label: string;
  value: string;
  caption: string;
}

export interface ProblemCard {
  title: string;
  description: string;
  metric: string;
}

export interface HowItWorksStep {
  title: string;
  description: string;
  accent: string;
}

export interface FeatureCard {
  title: string;
  description: string;
  eyebrow: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  improvement: string;
}

export interface PrivacyPillar {
  title: string;
  description: string;
}

export interface SummaryCard {
  title: string;
  value: string;
  delta: string;
  note: string;
  tone: PostureState | "info";
}

export interface FeedbackEvent {
  minute: string;
  state: PostureState;
  title: string;
  score: number;
  detail: string;
}

export interface HealthWidget {
  title: string;
  value: string;
  note: string;
  trend: string;
}

export interface StretchSuggestion {
  title: string;
  duration: string;
  focus: string;
  difficulty: string;
  description: string;
}

export interface WeeklyTrendPoint {
  day: string;
  posture: number;
  focus: number;
  breaks: number;
}

export interface TimelinePoint {
  time: string;
  score: number;
  state: PostureState;
}

export interface RatioPoint {
  name: string;
  value: number;
  fill: string;
}

export interface Achievement {
  title: string;
  description: string;
  progress: number;
  unlocked: boolean;
}

export interface CoachIdentity {
  level: string;
  vibe: string;
  specialty: string;
  progressLabel: string;
  progressValue: number;
}

export interface InsightCard {
  title: string;
  description: string;
  stat: string;
}

export interface TomorrowRecommendation {
  title: string;
  description: string;
  time: string;
}

export interface DailyComparison {
  todayScore: number;
  deltaVsYesterday: number;
  productiveWindow: string;
  recoveryMinutes: number;
}

export interface ExerciseCard {
  id?: string;
  title: string;
  description: string;
  duration: string;
  durationSeconds?: number;
  difficulty: ExerciseDifficulty;
  targetArea: BodyArea;
  intensity: ExerciseIntensity;
  safetyNote?: string;
  steps?: ExerciseStep[];
}

export interface ExerciseStep {
  title: string;
  instruction: string;
  durationSeconds: number;
}

export interface ReminderPreset {
  label: string;
  minutes: number;
}
