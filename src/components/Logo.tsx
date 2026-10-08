interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className="nesmi-logo flex items-center gap-2">
      {/* Approved black-background Nesmi artwork stays consistent in every theme. */}
      <div className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-xl`}>
        <img
          src={`${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png`}
          alt={showText ? '' : 'Nesmi'}
          className="block h-full w-full object-contain"
          width="64"
          height="64"
        />
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`${textSizeClasses[size]} nesmi-wordmark`}>
            Nesmi
          </span>
          {size === 'lg' && (
            <span className="text-xs text-content-secondary -mt-1">Family Chore Manager</span>
          )}
        </div>
      )}
    </div>
  );
}

