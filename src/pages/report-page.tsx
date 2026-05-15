import { ArrowRight, CalendarDays, Clock, Dumbbell, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "@/components/shared/language-provider";
import {
  CyberButton,
  CyberCard,
  CyberShell,
  MetricTile,
  ScoreRing,
  SparkBar,
  formatCompactDate,
  percent,
} from "@/components/cyber/cyber-ui";
import { formatDurationMinutes, formatHourRange } from "@/runtime/display";
import { getDayKey } from "@/runtime/logic";
import { getCompletedRecoverySecondsForDay } from "@/runtime/recovery";
import { usePostureRuntime } from "@/runtime/posture-runtime-provider";
import type { DailySummary } from "@/runtime/types";
import type { ThemeMode } from "@/types/posture";

interface ReportPageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
}

function DeltaBadge({ summary, previous }: { summary: DailySummary; previous: DailySummary | null }) {
  const delta = previous ? Math.round(summary.score - previous.score) : null;
  const positive = delta === null || delta >= 0;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${positive ? "cyber-panel-mint" : "cyber-panel-red"}`}>
      {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
      {delta === null ? "--" : `${delta > 0 ? "+" : ""}${delta}`}
    </div>
  );
}

export function ReportPage({ resolvedTheme, onThemeCycle }: ReportPageProps) {
  const { messages, language } = useLanguage();
  const { recoveryActivities, summaries, todaySummary, usingDemoHistory } = usePostureRuntime();
  const dataSummaries = summaries.filter((summary) => summary.trackedMs >= 5 * 60 * 1000);
  const reportSummary = todaySummary && todaySummary.trackedMs >= 5 * 60 * 1000
    ? todaySummary
    : dataSummaries.at(-1) ?? null;
  const previousDayKey = reportSummary
    ? getDayKey(new Date(`${reportSummary.dayKey}T00:00:00`).getTime() - 24 * 60 * 60 * 1000)
    : null;
  const previousSummary = previousDayKey
    ? dataSummaries.find((summary) => summary.dayKey === previousDayKey) ?? null
    : null;
  const weekly = dataSummaries.slice(-7).map((summary) => ({
    day: formatCompactDate(summary.dayKey),
    score: Math.round(summary.score),
  }));

  if (!reportSummary) {
    return (
      <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
        <section className="grid min-h-[68vh] place-items-center">
          <CyberCard className="max-w-2xl p-8 text-center" tone="cyan">
            <p className="cyber-eyebrow">{messages.report.noData.eyebrow}</p>
            <h1 className="t-display mt-3">{messages.report.noData.title}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">{messages.report.noData.description}</p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              {messages.report.noData.steps.map((step) => (
                <div key={step} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-strong)]">
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <CyberButton to="/dashboard">{messages.report.noData.primaryCta}</CyberButton>
              <CyberButton variant="secondary" to="/recovery">{messages.report.noData.secondaryCta}</CyberButton>
            </div>
          </CyberCard>
        </section>
      </CyberShell>
    );
  }

  const tracked = reportSummary.trackedMs;
  const pieData = [
    { name: messages.report.overview.ratio[0]?.name ?? "Good", value: reportSummary.goodMs, fill: "#00F5C0" },
    { name: messages.report.overview.ratio[1]?.name ?? "Warning", value: reportSummary.warningMs, fill: "#F59E0B" },
    { name: messages.report.overview.ratio[2]?.name ?? "Bad", value: reportSummary.badMs, fill: "#EF4444" },
  ];
  const recoveryMinutes = Math.round(getCompletedRecoverySecondsForDay(recoveryActivities, reportSummary.dayKey) / 60);

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cyber-eyebrow">{messages.report.page.badge}</p>
          <h1 className="t-display mt-2">{formatCompactDate(reportSummary.dayKey)}</h1>
          {usingDemoHistory && (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {language === "vi" ? "Dữ liệu mẫu để xem trước báo cáo" : "Sample data preview"}
            </p>
          )}
        </div>
        <CyberButton to="/dashboard" variant="secondary">
          {messages.report.page.loadedCta}
          <ArrowRight size={16} />
        </CyberButton>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
        <CyberCard tone={reportSummary.score >= 75 ? "mint" : reportSummary.score >= 50 ? "amber" : "red"} className="p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreRing score={reportSummary.score} size={128} label={messages.report.overview.todayLabel} />
            <div className="flex-1">
              <p className="cyber-eyebrow">{messages.report.overview.scoreEyebrow}</p>
              <h2 className="mt-2 t-heading-xl">
                {messages.report.overview.todayNote}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <DeltaBadge summary={reportSummary} previous={previousSummary} />
                <span className="text-sm text-[var(--muted)]">
                  {previousSummary ? messages.report.overview.deltaNote : language === "vi" ? "Chưa có dữ liệu hôm trước để so sánh." : "No previous-day data yet."}
                </span>
              </div>
            </div>
          </div>
        </CyberCard>

        <div className="grid grid-cols-2 gap-3">
          <MetricTile label={messages.report.overview.bestWindowLabel} value={formatHourRange(reportSummary.bestHour)} tone="mint" />
          <MetricTile label={messages.report.overview.recoveryMinutesLabel} value={recoveryMinutes} detail="min" tone="violet" />
          <MetricTile label={language === "vi" ? "Thời gian theo dõi" : "Tracked time"} value={formatDurationMinutes(reportSummary.trackedMs)} tone="cyan" />
          <MetricTile label={language === "vi" ? "Phiên" : "Sessions"} value={reportSummary.sessionsCount} tone="amber" />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.report.overview.ratioEyebrow}</p>
          <h2 className="mt-2 t-heading-md">{messages.report.overview.ratioTitle}</h2>
          <div className="mt-5 flex items-center gap-5">
            <PieChart width={132} height={132}>
              <Pie data={pieData} cx={64} cy={64} innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-3">
              {pieData.map((entry) => (
                <div key={entry.name}>
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span className="text-[var(--muted)]">{entry.name}</span>
                    <span style={{ color: entry.fill }}>{percent(entry.value, tracked)}%</span>
                  </div>
                  <SparkBar value={entry.value} max={tracked || 1} tone={entry.fill === "#00F5C0" ? "mint" : entry.fill === "#F59E0B" ? "amber" : "red"} />
                </div>
              ))}
            </div>
          </div>
        </CyberCard>

        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.report.overview.sittingEyebrow}</p>
          <h2 className="mt-2 t-heading-md">{messages.report.overview.sittingTitle}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricTile label={language === "vi" ? "Tư thế tốt" : "Good posture"} value={formatDurationMinutes(reportSummary.goodMs)} tone="mint" />
            <MetricTile label={language === "vi" ? "Cảnh báo" : "Warning"} value={formatDurationMinutes(reportSummary.warningMs)} tone="amber" />
            <MetricTile label={language === "vi" ? "Tư thế xấu" : "Bad posture"} value={formatDurationMinutes(reportSummary.badMs)} tone="red" />
            <MetricTile label={language === "vi" ? "Cần phân tích" : "Analyzing"} value={formatDurationMinutes(reportSummary.analyzingMs)} tone="cyan" />
          </div>
        </CyberCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.report.insights.insightsEyebrow}</p>
          <h2 className="mt-2 t-heading-md">{messages.report.insights.insightsTitle}</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl cyber-panel-mint p-4">
              <CalendarDays className="mb-3" size={18} />
              <strong>{messages.report.overview.bestWindowLabel}: {formatHourRange(reportSummary.bestHour)}</strong>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{messages.report.insights.cards[0]?.description}</p>
            </div>
            <div className="rounded-2xl cyber-panel-amber p-4">
              <Clock className="mb-3" size={18} />
              <strong>{language === "vi" ? "Cần hỗ trợ" : "Needs support"}: {formatHourRange(reportSummary.worstHour)}</strong>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{messages.report.insights.cards[1]?.description}</p>
            </div>
            <div className="rounded-2xl cyber-panel-violet p-4">
              <Dumbbell className="mb-3" size={18} />
              <strong>{messages.report.insights.tomorrowEyebrow}</strong>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{messages.report.insights.recommendations[1]?.description}</p>
            </div>
          </div>
        </CyberCard>

        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.report.insights.tomorrowTitle}</p>
          {weekly.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={weekly} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.24)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} />
                <Area type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={2} fill="url(#reportScore)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
              {language === "vi" ? "Cần thêm ngày dữ liệu để xem xu hướng." : "Track more days to unlock trend lines."}
            </p>
          )}
        </CyberCard>
      </section>
    </CyberShell>
  );
}
