import React from 'react';
import type { ButtonVariant } from './tokens';

export function SurfaceCard({
  children,
  highlighted = false,
  className = '',
}: {
  children: React.ReactNode;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-[var(--cp-bg-elevated)]/90 backdrop-blur-sm border transition-all duration-200 ${
        highlighted
          ? 'border-[var(--cp-border-strong)] shadow-[0_22px_48px_-22px_rgba(3,9,20,0.9),inset_0_1px_0_rgba(214,173,85,0.18)]'
          : 'border-[var(--cp-border)] shadow-[0_10px_24px_-12px_rgba(3,9,20,0.55)]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function ActionButton({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ActionButtonProps) {
  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] font-semibold hover:from-[#F0D185] hover:to-[#DFB862] shadow-md shadow-[#030914]/35 border border-[#F3D892]/40',
    secondary:
      'bg-[var(--cp-surface)] text-[var(--cp-text)] font-medium border border-[var(--cp-border)] hover:bg-[var(--cp-surface-muted)] hover:border-[var(--cp-border-strong)]',
    ghost:
      'bg-transparent text-[var(--cp-text-muted)] font-medium hover:text-[var(--cp-text)] hover:bg-[var(--cp-surface)]/60',
    danger:
      'bg-[#D94343] text-[#F4EBDD] font-semibold hover:bg-[#C33636]',
  };

  return (
    <button
      {...rest}
      className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer ${
        fullWidth ? 'w-full' : ''
      } ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h2
          className="font-display text-xl sm:text-2xl font-bold text-[var(--cp-text)]"
          style={{ textWrap: 'balance' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--cp-text-muted)]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <SurfaceCard className="p-4 sm:p-5">
      <div className="text-xs font-medium text-[var(--cp-text-muted)]">{label}</div>
      <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--cp-text)]">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--cp-text-muted)]">{hint}</div>
      )}
    </SurfaceCard>
  );
}
