export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSizes = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };
  return (
    <div className="flex items-center gap-2">
      <img src="/logo-icon.png" alt="TradeSmartDz" className={iconSizes[size]} />
      <span className={`${textSizes[size]} font-bold`}>
        <span className="text-foreground">TradeSmart</span><span className="text-primary">Dz</span>
      </span>
    </div>
  );
}
