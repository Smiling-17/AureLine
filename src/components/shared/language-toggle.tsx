import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/shared/language-provider";

interface LanguageToggleProps {
  className?: string;
  compact?: boolean;
}

export function LanguageToggle({ className, compact = false }: LanguageToggleProps) {
  const { language, setLanguage, messages } = useLanguage();

  return (
    <div
      role="group"
      aria-label={messages.common.languageToggleLabel}
      className={cn(
        "surface-chip flex items-center rounded-full",
        compact ? "h-8 gap-0 px-0.5 py-0.5 shadow-[0_4px_12px_rgba(15,23,42,0.05)]" : "gap-1 p-1",
        className,
      )}
    >
      <div className={cn("items-center gap-2 pl-2 pr-1 text-[var(--muted)]", compact ? "hidden" : "hidden sm:flex")}>
        <Languages className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-[0.24em]">
          {messages.common.languageToggleLabel}
        </span>
      </div>
      {messages.common.languageOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={language === option.value}
          onClick={() => setLanguage(option.value)}
          className={cn(
            "rounded-full font-semibold uppercase transition-all duration-200",
            compact ? "h-7 min-w-[2.1rem] px-2.5 py-1 text-[11px] tracking-[0.12em]" : "px-3 py-2 text-xs tracking-[0.22em]",
            language === option.value
              ? "bg-[var(--surface-inset)] text-[var(--foreground)] shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
              : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]",
          )}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  );
}
