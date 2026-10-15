import { useId } from 'react';
import './Logo.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const artworkUrl = `${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png`;

/** Reuse the approved artwork without reproducing or tracing its wreath geometry. */
function LogoGlyph({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const filterId = `nesmi-glyph-alpha-${id}`;
  const maskId = `nesmi-glyph-mask-${id}`;

  return (
    <svg className={className} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
      <defs>
        <filter id={filterId} filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024" colorInterpolationFilters="sRGB">
          <feColorMatrix type="luminanceToAlpha" />
          <feComponentTransfer>
            {/* The original RGB background is 0–6, not perfectly black. */}
            <feFuncA type="linear" slope={255 / 249} intercept={-6 / 249} />
          </feComponentTransfer>
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024" style={{ maskType: 'alpha' }}>
          <image href={artworkUrl} width="1024" height="1024" filter={`url(#${filterId})`} />
        </mask>
      </defs>
      <rect width="1024" height="1024" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
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
      {showText && size !== 'lg' ? (
        <span className="nesmi-header-icon shrink-0 overflow-hidden" aria-hidden="true">
          <LogoGlyph className="nesmi-header-glyph" />
          <img src={artworkUrl} alt="" width="32" height="32" className="nesmi-header-dark-artwork h-full w-full object-contain" />
        </span>
      ) : (
        <span
          className={`${sizeClasses[size]} nesmi-transparent-logo-mark shrink-0`}
          role={showText ? undefined : 'img'}
          aria-label={showText ? undefined : 'Nesmi'}
          aria-hidden={showText ? true : undefined}
        >
          <LogoGlyph />
        </span>
      )}

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
