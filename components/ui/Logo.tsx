export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="22" stroke="rgb(212 184 118)" strokeWidth="1.5" />
        <path
          d="M24 8 L24 24 L34 30"
          stroke="rgb(212 184 118)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="24" cy="24" r="1.6" fill="rgb(212 184 118)" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-display text-lg tracking-tight text-ink-100">
          22<span className="text-gold-400">h</span>22
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-ink-300/80">
          Affiliation
        </span>
      </div>
    </div>
  );
}
