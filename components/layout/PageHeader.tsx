import { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.22em] text-gold-400/80">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl tracking-tight text-ink-100 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-ink-300">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
