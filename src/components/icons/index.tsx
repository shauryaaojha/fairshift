// Custom line icons for FairShift. 24 px grid, 2 px stroke, round joins.
// No icon library. Every icon is decorative (aria-hidden) and is always
// paired with a visible word, as the design system requires.
import type { SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number;
};

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </Base>
);

export const HardHatIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 18h18" />
    <path d="M5 18v-1a7 7 0 0 1 14 0v1" />
    <path d="M10 10V6h4v4" />
    <path d="M12 6V4" />
  </Base>
);

export const BroomIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 3 10 12" />
    <path d="M7.5 12h6l2.5 8H5z" />
    <path d="M8.5 16.5 8 20" />
    <path d="M11.5 16.5V20" />
  </Base>
);

export const RupeeNoteIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
    <path d="M9 9.5h6" />
    <path d="M9 12h6" />
    <path d="M9.5 9.5c2.5 0 3 2.5 0 2.5l3 3" />
  </Base>
);

export const ConeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 4h4l4.5 15h-13z" />
    <path d="M8.2 11h7.6" />
    <path d="M3 19h18" />
  </Base>
);

export const SpeechLockIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h13a1.5 1.5 0 0 1 1.5 1.5V11" />
    <path d="M4 5v10.5h4V19l4-3.5h1.5" />
    <rect x="14" y="14" width="8" height="6" rx="1" />
    <path d="M16 14v-1.5a2 2 0 0 1 4 0V14" />
  </Base>
);

export const ClockCardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 9.5V12l1.8 1.2" />
  </Base>
);

export const BadgeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m9.5 9 1.8 1.8L14.7 7.4" />
    <path d="m8.5 13.8-1.7 7 5.2-2.6 5.2 2.6-1.7-7" />
  </Base>
);

export const SpeakerIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Base>
);

export const MicIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3" />
  </Base>
);

export const BackIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 5 8 12l7 7" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const QrIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <path d="M14 14h2.5v2.5H14z" />
    <path d="M20.5 14v2.5M17 20.5h3.5M14 20.5v-1" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);

export const BoltIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />
  </Base>
);

export const FlameIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3c.5 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.2-4.8.2 1.4.9 2.3 1.8 2.8C10.2 9 10.7 5.5 12 3z" />
  </Base>
);

export const LadderIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 3v18M17 3v18" />
    <path d="M7 7.5h10M7 12h10M7 16.5h10" />
  </Base>
);

export const DotsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="5.5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18.5" cy="12" r="1.2" />
  </Base>
);

export const ShareIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 15V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 13v6.5h14V13" />
  </Base>
);

export const GlobeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 3.7 5.6 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
  </Base>
);

export const BackspaceIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 5h11v14H9l-6-7z" />
    <path d="m12.5 9.5 5 5M17.5 9.5l-5 5" />
  </Base>
);

/** Face scale, 1 (very unhappy) to 5 (very happy). Mouth curve changes. */
export function FaceIcon({ level, ...p }: IconProps & { level: 1 | 2 | 3 | 4 | 5 }) {
  const mouths: Record<number, string> = {
    1: 'M8 17c1-2.2 7-2.2 8 0',
    2: 'M8.5 16.2c1.2-1.2 5.8-1.2 7 0',
    3: 'M8.5 16h7',
    4: 'M8.5 14.8c1.2 1.4 5.8 1.4 7 0',
    5: 'M7.8 14c1 3.4 7.4 3.4 8.4 0z',
  };
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9 9.5v.5M15 9.5v.5" />
      <path d={mouths[level]} />
    </Base>
  );
}

/** A phone with a downward arrow: "add to home screen". */
export const InstallIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M12 7v7" />
    <path d="m9 11 3 3 3-3" />
    <path d="M10 18h4" />
  </Base>
);

export const SunIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const ScalesIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v16" />
    <path d="M8 20h8" />
    <path d="M5 7h14" />
    <path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7z" />
    <path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
  </Base>
);

export const AskIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h16v11H9l-5 4V5z" />
    <path d="M10 9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2" />
    <path d="M12 14.5h.01" />
  </Base>
);
