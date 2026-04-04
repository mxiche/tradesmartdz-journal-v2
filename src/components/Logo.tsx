export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes     = { sm: 'text-sm',  md: 'text-base', lg: 'text-xl' };
  const iconSizes = { sm: 'h-8 w-20', md: 'h-10 w-24', lg: 'h-14 w-32' };
  return (
    <div className="relative flex items-center justify-center" style={{ width: 'fit-content' }}>
      <img src="/logo-icon.png" alt="" className={iconSizes[size]} />
      <span className={`absolute ${sizes[size]} font-bold text-foreground drop-shadow-md`}>
        Trade<span className="text-white">Smart</span><span className="text-primary">Dz</span>
      </span>
    </div>
  );
}
