import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="text-left">{children}</thead>;
}

export function Tr({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={`border-b border-gold-400/5 last:border-0 hover:bg-forest-900/30 ${className}`}
    >
      {children}
    </tr>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="border-b border-gold-400/10 px-4 py-3 text-xs font-medium uppercase tracking-wider text-ink-300">
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-ink-100 ${className}`}>{children}</td>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-16 text-center text-sm text-ink-300/70">
      {message}
    </div>
  );
}
