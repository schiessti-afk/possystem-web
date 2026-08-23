import type { ReactNode } from "react";

/**
 * Stroke icons from possystem/design/icons — 24-grid, 2px round,
 * currentColor. Only the ones that map onto this dashboard.
 */
const PATHS = {
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.2 9.5v.01M17.8 14.5v.01" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </>
  ),
  "card-credit": (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6.5 15h3" />
      <path d="M15.8 13.2a4.4 4.4 0 0 1 0 3.1" />
      <path d="M18.1 12a7.6 7.6 0 0 1 0 5.5" />
    </>
  ),
  "card-debit": (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <rect x="6" y="13.5" width="4" height="3" rx="0.8" />
      <path d="M14 15h3.5" />
    </>
  ),
  pix: (
    <>
      <path d="M12.9 3.6a1.3 1.3 0 0 0-1.8 0L3.6 11.1a1.3 1.3 0 0 0 0 1.8l7.5 7.5a1.3 1.3 0 0 0 1.8 0l7.5-7.5a1.3 1.3 0 0 0 0-1.8L12.9 3.6Z" />
      <path d="M12 15.4 8.6 12 12 8.6l3.4 3.4L12 15.4Z" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 8V7a2 2 0 0 1 2-2h11" />
      <rect x="4" y="8" width="17" height="11" rx="2.5" />
      <path d="M21 12.5h-3.5a1.75 1.75 0 0 0 0 3.5H21" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4L10 21l-2-1.4L6 21V3Z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </>
  ),
  refund: <path d="M3 10h10a5 5 0 0 1 5 5v3.5M7 6 3 10l4 4" />,
  "cash-in": (
    <>
      <rect x="6" y="14" width="12" height="7" rx="1.5" />
      <circle cx="12" cy="17.5" r="1.4" />
      <path d="M12 12V4" />
      <path d="m9 7 3-3 3 3" />
    </>
  ),
  drop: (
    <>
      <rect x="6" y="3" width="12" height="7" rx="1.5" />
      <circle cx="12" cy="6.5" r="1.4" />
      <path d="M12 12v8" />
      <path d="m9 17 3 3 3-3" />
    </>
  ),
  "drawer-open": (
    <>
      <path d="M6 9V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <rect x="3" y="9" width="18" height="9" rx="2" />
      <path d="M10 13.5h4" />
    </>
  ),
  "drawer-close": (
    <>
      <path d="M6 9V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <rect x="3" y="9" width="18" height="9" rx="2" />
      <path d="m9.5 13.5 1.8 1.8 3.4-3.6" />
    </>
  ),
  sync: (
    <>
      <path d="M20 11a8 8 0 0 0-14.93-3" />
      <path d="M4 13a8 8 0 0 0 14.93 3" />
      <path d="M20 4v4h-4" />
      <path d="M4 20v-4h4" />
    </>
  ),
  synced: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </>
  ),
  offline: (
    <>
      <path d="M7 17.5a4.3 4.3 0 0 1-.57-8.56A6.2 6.2 0 0 1 18.4 7.6 3.9 3.9 0 0 1 17.5 15" />
      <path d="M7 17.5h8.5" />
      <path d="m4.5 4.5 15 15" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.01" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export default function Icon({ name, size = 18, className, title }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `icon ${className}` : "icon"}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[name]}
      </g>
    </svg>
  );
}
