// Line icons, drawn on a 24 px grid.

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const MicIcon = ({ size = 20 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const StopIcon = ({ size = 20 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
  </svg>
);

export const SlidersIcon = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const ClockIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);

export const ResetIcon = () => (
  <svg {...base}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </svg>
);

export const PlayIcon = () => (
  <svg {...base}>
    <path d="M8 5l11 7-11 7z" fill="currentColor" />
  </svg>
);
