// MEETIX brand logo, rebuilt as crisp SVG so it scales anywhere and stays
// sharp on retina / when installed as a PWA. Gradient "M" mark with the accent
// dot, plus the "meeti·x" wordmark (x in the violet accent).

let gid = 0;

export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  // Unique gradient id per instance so multiple marks on a page don't collide.
  const id = `meetix-mark-${gid++}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="MEETIX"
    >
      <defs>
        <linearGradient id={id} x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M6 40 L16 9 L24 27 L32 9 L42 40"
        stroke={`url(#${id})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="8" r="4.2" fill="#A855F7" />
    </svg>
  );
}

export default function Logo({
  variant = 'full',
  size = 40,
  className = '',
  textClass = 'text-slate-900',
  tagline = true,
}: {
  variant?: 'full' | 'mark';
  size?: number;
  className?: string;
  textClass?: string;
  tagline?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} className="shrink-0" />
      {variant === 'full' && (
        <div className="leading-none">
          <div className={`text-2xl font-bold lowercase tracking-tight ${textClass}`}>
            meeti<span style={{ color: '#8B5CF6' }}>x</span>
          </div>
          {tagline && (
            <div className={`mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] ${textClass} opacity-60`}>
              Meetings &amp; MICE
            </div>
          )}
        </div>
      )}
    </div>
  );
}
