import { TrendingUp } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };
  const iconSizes = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' };
  return (
    <div className="flex items-center gap-2">
      <div className="gradient-primary rounded-lg p-1.5">
        <TrendingUp className={`${iconSizes[size]} text-primary-foreground`} />
      </div>
      <span className={`${sizes[size]} font-bold text-foreground`}>TradeSmartDz</span>
    </div>
  );
}
