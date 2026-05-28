import { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
  delay = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="rise relative overflow-hidden rounded-2xl border border-gold-400/10 bg-forest-800/40 p-5 backdrop-blur-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      {accent && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-300/80">
            {label}
          </p>
          <p className="font-display text-2xl font-medium leading-tight text-ink-100">
            {value}
          </p>
          {hint && <p className="text-xs text-ink-300/70">{hint}</p>}
        </div>
        {icon && (
          <div className="rounded-xl border border-gold-400/15 bg-forest-900/60 p-2 text-gold-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
