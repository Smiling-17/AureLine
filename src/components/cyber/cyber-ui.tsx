import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  Dumbbell,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { useLanguage } from "@/components/shared/language-provider";
import { cn } from "@/lib/utils";
import type { PostureState, ThemeMode } from "@/types/posture";

type Tone = "cyan" | "mint" | "violet" | "amber" | "red" | "muted";

const toneClass: Record<Tone, string> = {
  cyan: "cyber-tone-cyan",
  mint: "cyber-tone-mint",
  violet: "cyber-tone-violet",
  amber: "cyber-tone-amber",
  red: "cyber-tone-red",
  muted: "cyber-tone-muted",
};

export const stateTone: Record<PostureState, Tone> = {
  good: "mint",
  warning: "amber",
  bad: "red",
};

export function CyberShell({
  children,
  resolvedTheme,
  onThemeCycle,
  landing = false,
}: {
  children: ReactNode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
  landing?: boolean;
}) {
  const { messages } = useLanguage();
  const location = useLocation();
  // 4 items only — Home is accessible via the logo brand in the topbar
  const appNav = [
    { label: messages.nav.app[0]?.label ?? "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: messages.nav.app[1]?.label ?? "Report",    href: "/report",    icon: BarChart2 },
    { label: messages.nav.app[2]?.label ?? "Recovery",  href: "/recovery",  icon: Dumbbell },
    { label: messages.nav.app[3]?.label ?? "Settings",  href: "/settings",  icon: Settings },
  ];

  return (
    <div className={cn("cyber-app", landing && "cyber-app-landing")}>
      <header className="cyber-topbar">
        <Link to="/" className="cyber-brand" aria-label={messages.meta.appName}>
          <span className="cyber-brand-mark">
            <img src="/logo_app.png" alt="" aria-hidden="true" />
          </span>
          <span>
            <span className="cyber-brand-name">{messages.meta.appName}</span>
            <span className="cyber-brand-tagline">{messages.meta.tagline}</span>
          </span>
        </Link>
        <div className="cyber-topbar-actions">
          <LanguageToggle compact />
          <button
            type="button"
            className="cyber-icon-button"
            onClick={onThemeCycle}
            aria-label={messages.common.themeCycleLabel}
          >
            {resolvedTheme === "midnight" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      <main className={cn("cyber-main", landing && "cyber-main-landing")}>{children}</main>

      {!landing && (
        <nav className="cyber-bottom-nav" aria-label={messages.common.navigationLabel}>
          {appNav.map(({ href, icon: Icon, label }) => {
            const active = location.pathname.startsWith(href);
            return (
              <NavLink
                key={href}
                to={href}
                end={href === "/"}
                className={cn("cyber-nav-item", active && "is-active")}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function CyberCard({
  children,
  className,
  tone = "muted",
  style,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  style?: CSSProperties;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: "easeOut",
        delay: index * 0.03,
      }}
      className={cn("cyber-card", toneClass[tone], className)}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function CyberButton({
  children,
  className,
  variant = "primary",
  to,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  to?: string;
}) {
  const classes = cn("cyber-button", `cyber-button-${variant}`, className);

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 9,
  label,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label: string;
}) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const tone = safeScore >= 75 ? "mint" : safeScore >= 50 ? "amber" : "red";

  return (
    <div className={cn("score-ring", toneClass[tone])} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        />
      </svg>
      <div className="score-ring-label">
        <strong>{safeScore}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function PostureBadge({
  state,
  label,
  muted = false,
}: {
  state: PostureState | "idle" | "analyzing";
  label: string;
  muted?: boolean;
}) {
  const tone = state === "good" ? "mint" : state === "warning" ? "amber" : state === "bad" ? "red" : state === "analyzing" ? "cyan" : "muted";
  return (
    <span className={cn("posture-badge", toneClass[tone], muted && "is-muted")}>
      <span />
      {label}
    </span>
  );
}

export function SparkBar({
  value,
  max = 100,
  tone = "cyan",
}: {
  value: number;
  max?: number;
  tone?: Tone;
}) {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="spark-bar">
      <motion.div
        className={toneClass[tone]}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      />
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "cyan",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={cn("metric-tile", toneClass[tone])}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function CyberTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="cyber-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={cn(value === tab.value && "is-active")}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CyberToggle({
  checked,
  onChange,
  label,
  tone = "cyan",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn("cyber-toggle", checked && "is-on", toneClass[tone])}
    >
      <span />
    </button>
  );
}

export function formatCompactDate(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
