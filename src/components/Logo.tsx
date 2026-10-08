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
      {/* Use the approved artwork as a luminance mask: the exact nest silhouette,
          with theme-aware ink and a transparent canvas. App/store icons stay unchanged. */}
      <span
        className={`${sizeClasses[size]} nesmi-logo-mark shrink-0`}
        role={showText ? undefined : 'img'}
        aria-label={showText ? undefined : 'Nesmi'}
        aria-hidden={showText ? true : undefined}
        style={{
          maskImage: `url("${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png")`,
          WebkitMaskImage: `url("${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png")`,
        }}
      />

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

