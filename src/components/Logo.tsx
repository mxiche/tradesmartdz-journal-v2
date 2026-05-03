export function LogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/logo-icon.png"
      alt="TradeSmartDz"
      className={className}
      style={{ objectFit: 'contain' }}
    />
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
