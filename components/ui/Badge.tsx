import { ReactNode } from "react";
import type { StatutCommission } from "@/lib/types";

const STATUT_STYLES: Record<StatutCommission, string> = {
  a_valider: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  validee:   "bg-sky-500/10 text-sky-300 border-sky-500/20",
  a_payer:   "bg-violet-500/10 text-violet-300 border-violet-500/20",
  payee:     "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  annulee:   "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const STATUT_LABELS: Record<StatutCommission, string> = {
  a_valider: "À valider",
  validee: "Validée",
  a_payer: "À payer",
  payee: "Payée",
  annulee: "Annulée",
};

export function StatutBadge({ statut }: { statut: StatutCommission }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUT_STYLES[statut]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUT_LABELS[statut]}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "muted";
}) {
  const styles = {
    neutral: "border-gold-400/20 bg-forest-900/60 text-ink-100",
    gold: "border-gold-400/40 bg-gold-400/10 text-gold-400",
    muted: "border-ink-300/15 bg-ink-900/50 text-ink-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
