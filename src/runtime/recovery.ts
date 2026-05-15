import type { BodyArea, ExerciseCard } from "@/types/posture";
import type {
  DistanceStatus,
  IssueFamily,
  LoadSource,
  RecoveryActivityRecord,
  RecoveryActivitySource,
  RuntimeCue,
  TaskState,
} from "@/runtime/types";

const issueAreaMap: Record<IssueFamily, BodyArea> = {
  "forward-head": "neck",
  "shoulder-tilt": "shoulders",
  "torso-lean": "back",
};

export interface RecoveryRecommendationInput {
  cards: ExerciseCard[];
  dominantIssue: IssueFamily | null;
  distanceStatus?: DistanceStatus;
  latestCueKind?: RuntimeCue["kind"] | null;
  recentCompletions?: RecoveryActivityRecord[];
  effectiveTask?: TaskState;
  loadSource?: LoadSource | null;
}

export interface RecoveryRecommendation {
  flowId: string;
  targetArea: BodyArea;
  reason: "distance" | "issue" | "load" | "break" | "default";
}

export function issueToRecoveryBodyArea(issue: IssueFamily | null): BodyArea {
  return issue ? issueAreaMap[issue] : "back";
}

function cardId(card: ExerciseCard) {
  return card.id ?? card.title;
}

function findCardByArea(cards: ExerciseCard[], area: BodyArea, recentCompletions: RecoveryActivityRecord[]) {
  const recentlyCompleted = new Set(recentCompletions.map((item) => item.flowId));
  return (
    cards.find((card) => card.targetArea === area && !recentlyCompleted.has(cardId(card))) ??
    cards.find((card) => card.targetArea === area) ??
    cards[0]
  );
}

export function selectRecoveryRecommendation({
  cards,
  dominantIssue,
  distanceStatus = "ok",
  latestCueKind = null,
  recentCompletions = [],
  effectiveTask = "unknown",
  loadSource = null,
}: RecoveryRecommendationInput): RecoveryRecommendation {
  const fallback = cards[0];
  if (!fallback) {
    return {
      flowId: "desk-reset",
      targetArea: "back",
      reason: "default",
    };
  }

  if (distanceStatus === "too-close") {
    const card = findCardByArea(cards, "neck", recentCompletions) ?? fallback;
    return {
      flowId: cardId(card),
      targetArea: card.targetArea,
      reason: "distance",
    };
  }

  if (dominantIssue) {
    const card = findCardByArea(cards, issueToRecoveryBodyArea(dominantIssue), recentCompletions) ?? fallback;
    return {
      flowId: cardId(card),
      targetArea: card.targetArea,
      reason: "issue",
    };
  }

  if (loadSource === "static-hold" || loadSource === "compound") {
    const area = effectiveTask === "typing"
      ? "shoulders"
      : effectiveTask === "phone-tablet"
        ? "neck"
        : "back";
    const card = findCardByArea(cards, area, recentCompletions) ?? fallback;
    return {
      flowId: cardId(card),
      targetArea: card.targetArea,
      reason: "load",
    };
  }

  if (latestCueKind === "break") {
    const card = cards.find((item) => cardId(item) === "desk-reset") ?? findCardByArea(cards, "back", recentCompletions) ?? fallback;
    return {
      flowId: cardId(card),
      targetArea: card.targetArea,
      reason: "break",
    };
  }

  const card = cards.find((item) => cardId(item) === "desk-reset") ?? fallback;
  return {
    flowId: cardId(card),
    targetArea: card.targetArea,
    reason: "default",
  };
}

export function parseRecoverySource(value: string | null): RecoveryActivitySource {
  if (
    value === "dashboard" ||
    value === "report" ||
    value === "recovery" ||
    value === "break-cue" ||
    value === "distance-advisory"
  ) {
    return value;
  }

  return "recovery";
}

export function getCompletedRecoverySecondsForDay(records: RecoveryActivityRecord[], dayKey: string) {
  return records
    .filter((record) => record.dayKey === dayKey && record.completedAt !== null)
    .reduce((sum, record) => sum + record.completedSeconds, 0);
}
