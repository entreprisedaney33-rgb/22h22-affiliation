"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback silencieux
    }
  };

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-gold-400/20 bg-forest-900/60">
      <div className="flex-1 truncate px-4 py-3 font-mono text-sm text-ink-100">
        {value}
      </div>
      <button
        onClick={onCopy}
        className="flex items-center gap-2 border-l border-gold-400/15 bg-gold-400/5 px-4 text-xs font-medium uppercase tracking-wider text-gold-400 transition-colors hover:bg-gold-400/15"
      >
        {copied ? (
          <>
            <Check size={14} />
            Copié
          </>
        ) : (
          <>
            <Copy size={14} />
            Copier
          </>
        )}
      </button>
    </div>
  );
}
