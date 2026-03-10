import { Status } from '../../types';

const statusConfig: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  DRAFT: { label: 'DRAFT', bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  LIVE: { label: 'LIVE', bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  STOPPED: { label: 'STOPPED', bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  COMPLETED: { label: 'COMPLETED', bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
};

interface StatusBadgeProps {
  status: Status;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, showDot = true, size = 'sm' }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: cfg.bg,
        color: cfg.text,
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {showDot && (
        <span
          className="rounded-full shrink-0"
          style={{ width: 5, height: 5, background: cfg.dot }}
        />
      )}
      {cfg.label}
    </span>
  );
}
