import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const baseSvgProps = (size: number = 16) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* Workspace Icons */
export const CommandCenterIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <path d="M2 6h12" />
    <path d="M6 14V6" />
  </svg>
);

export const QuarantineIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7L8 1.5z" />
    <path d="M8 5v4" />
    <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
  </svg>
);

export const CalibrationIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 2v2" />
    <path d="M8 12v2" />
    <path d="M2 8h2" />
    <path d="M12 8h2" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export const SourceProfileIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 2C5.5 5 3.5 7.5 3.5 10a4.5 4.5 0 009 0c0-2.5-2-5-4.5-8z" />
    <path d="M6 10a2 2 0 002 2" />
  </svg>
);

export const RecoveryFsmIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M2.5 8a5.5 5.5 0 101.6-3.9L2 6" />
    <path d="M2 2.5V6h3.5" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
);

export const ExposureIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M2 14h12" />
    <path d="M4 11l3-4 3 2 4-6" />
    <circle cx="14" cy="3" r="1" />
  </svg>
);

export const ChallengeRigIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polygon points="4 2 13 8 4 14 4 2" />
  </svg>
);

export const AuditTrailIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <rect x="3" y="2" width="10" height="12" rx="1.5" />
    <path d="M5.5 5.5h5" />
    <path d="M5.5 8.5h5" />
    <path d="M5.5 11.5h3" />
  </svg>
);

/* Utility & System Icons */
export const ThemeIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 2v12" />
    <path d="M8 2a6 6 0 010 12z" fill="currentColor" opacity={0.3} />
  </svg>
);

export const ValveOpenIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polygon points="2 4 8 8 2 12 2 4" />
    <polygon points="14 4 8 8 14 12 14 4" />
    <path d="M8 3v10" strokeWidth={2} />
  </svg>
);

export const ValveClosedIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polygon points="2 4 8 8 2 12 2 4" />
    <polygon points="14 4 8 8 14 12 14 4" />
    <line x1="8" y1="2" x2="8" y2="14" strokeWidth={2.2} />
  </svg>
);

export const PurgeIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 2v8" />
    <path d="M5 7l3 3 3-3" />
    <path d="M3 14h10" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polyline points="3 8 6.5 11.5 13 4.5" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 2L1.5 13.5h13L8 2z" />
    <line x1="8" y1="6" x2="8" y2="9.5" />
    <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
  </svg>
);

export const ErrorIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="6" />
    <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" />
    <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.8.8M11.8 11.8l.8.8M3.4 12.6l.8-.8M11.8 4.2l.8-.8" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polyline points="6 3 11 8 6 13" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polyline points="10 3 5 8 10 13" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
    <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M2.5 8a5.5 5.5 0 101.2-3.4L2 6" />
    <polyline points="2 2.5 2 6 5.5 6" />
  </svg>
);

export const ExportIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 2v7.5" />
    <polyline points="5 6.5 8 9.5 11 6.5" />
    <path d="M2.5 11.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <rect x="3" y="6.5" width="10" height="7.5" rx="1.5" />
    <path d="M5.5 6.5V4.5a2.5 2.5 0 015 0v2" />
  </svg>
);

export const ActivityIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <polyline points="1.5 8 4.5 8 6.5 2.5 9.5 13.5 11.5 8 14.5 8" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 1.5L2.5 4v4c0 3.8 2.3 5.8 5.5 6.5 3.2-.7 5.5-2.7 5.5-6.5V4L8 1.5z" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseSvgProps(size)} className={className} style={style}>
    <path d="M8 2v8M4.5 7l3.5 3.5L11.5 7" />
    <path d="M2.5 12.5h11" />
  </svg>
);

