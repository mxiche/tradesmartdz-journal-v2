function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* ── Red candle (left) — bearish, going down ── */}
      {/* Wick top */}
      <line x1="7" y1="4" x2="7" y2="7" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      {/* Body */}
      <rect x="4.5" y="7" width="5" height="9" rx="0.75" fill="#ef4444" />
      {/* Wick bottom */}
      <line x1="7" y1="16" x2="7" y2="20" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      {/* Down arrow */}
      <polyline points="5,22 7,26 9,22" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="7" y1="22" x2="7" y2="26" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />

      {/* ── Green candle (right) — bullish, going up ── */}
      {/* Wick top */}
      <line x1="25" y1="4" x2="25" y2="8" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Body */}
      <rect x="22.5" y="8" width="5" height="9" rx="0.75" fill="#22c55e" />
      {/* Wick bottom */}
      <line x1="25" y1="17" x2="25" y2="20" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Up arrow */}
      <polyline points="23,24 25,20 27,24" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="25" y1="20" x2="25" y2="26" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />

      {/* ── Middle candle (center) — neutral/reference ── */}
      {/* Wick top */}
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
      {/* Body outline only */}
      <rect x="13.5" y="6" width="5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.4" fill="none" />
      {/* Wick bottom */}
      <line x1="16" y1="17" x2="16" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSizes = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };
  return (
    <div className="flex items-center gap-2">
      <LogoIcon className={iconSizes[size]} />
      <span className={`${textSizes[size]} font-bold`}>
        <span className="logo-text text-foreground">TradeSmart</span><span className="logo-dz text-primary">Dz</span>
      </span>
    </div>
  );
}
