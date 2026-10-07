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
    <div className="flex items-center gap-2">
      {/* Approved product artwork follows the active app theme. */}
      <div className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-xl`}>
        <img
          src={`${import.meta.env.BASE_URL}icons/chorely-light.png`}
          alt={showText ? '' : 'Nesmi'}
          className="block h-full w-full object-contain dark:hidden"
          width="64"
          height="64"
        />
        <img
          src={`${import.meta.env.BASE_URL}icons/chorely-dark.png`}
          alt={showText ? '' : 'Nesmi'}
          className="hidden h-full w-full object-contain dark:block"
          width="64"
          height="64"
        />
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span
            className={`${textSizeClasses[size]} font-bold`}
            style={{
              background: 'linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
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

