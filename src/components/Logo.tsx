export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes    = { sm: 'text-lg', md: 'text-xl',  lg: 'text-2xl' };
  const iconSizes = { sm: 'h-6 w-6', md: 'h-7 w-7', lg: 'h-9 w-9' };
  return (
    <div className="flex items-center gap-2">
      <img src="/logo-icon.png" alt="TradeSmartDz icon" className={iconSizes[size]} />
      <span className={`${sizes[size]} font-bold text-foreground`}>TradeSmartDz</span>
    </div>
  );
}
