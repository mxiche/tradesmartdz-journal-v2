export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Top ribbon — diagonal parallelogram */}
      <polygon points="6,4 26,4 22,14 2,14" fill="#22c55e" />
      {/* Top ribbon depth/shadow */}
      <polygon points="26,4 28,6 24,16 22,14" fill="#15803d" />

      {/* Bottom ribbon — diagonal parallelogram, opposite direction */}
      <polygon points="10,18 30,18 26,28 6,28" fill="#22c55e" />
      {/* Bottom ribbon depth/shadow */}
      <polygon points="30,18 32,20 28,30 26,28" fill="#15803d" />

      {/* Center connector — joins the two ribbons into S */}
      <polygon points="2,14 22,14 10,18 2,18" fill="#16a34a" />
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
