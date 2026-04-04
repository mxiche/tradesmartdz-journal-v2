export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-7', md: 'h-8', lg: 'h-10' };
  return (
    <img
      src="/logo.png"
      alt="TradeSmartDz"
      className={`${heights[size]} w-auto`}
    />
  );
}
