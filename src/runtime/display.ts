import type { IssueFamily } from "@/runtime/types";

export function formatDurationMinutes(ms: number) {
  return `${Math.round(ms / 60000)} min`;
}

export function formatDurationClock(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

export function formatScore(value: number) {
  return `${Math.round(value)} / 100`;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatHourRange(hour: number | null) {
  if (hour === null) return "--";
  const start = hour % 12 === 0 ? 12 : hour % 12;
  const endHour = (hour + 1) % 24;
  const end = endHour % 12 === 0 ? 12 : endHour % 12;
  const startPeriod = hour >= 12 ? "PM" : "AM";
  const endPeriod = endHour >= 12 ? "PM" : "AM";
  return `${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}`;
}

export function issueToBodyArea(issue: IssueFamily | null) {
  if (issue === "forward-head") return "neck";
  if (issue === "shoulder-tilt") return "shoulders";
  return "back";
}

