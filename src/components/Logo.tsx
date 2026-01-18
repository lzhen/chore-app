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
      {/* Logo Icon */}
      <div className={`${sizeClasses[size]} relative`}>
        {/* Background shape */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl shadow-lg" />

        {/* Inner icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className={`${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-10 h-10'} text-white`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {/* Clipboard base */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
            />
            {/* Clipboard top */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
            {/* Checkmark */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 12l2 2 4-4"
            />
          </svg>
        </div>

        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 0 50%)' }} />
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
            ChoreApp
          </span>
          {size === 'lg' && (
            <span className="text-xs text-content-secondary -mt-1">Office Task Manager</span>
          )}
        </div>
      )}
    </div>
  );
}
