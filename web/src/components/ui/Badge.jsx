import cx from '../../lib/cx.js';

const VARIANTES = {
  good: 'bg-good/[0.12] text-good-ink font-semibold',
  warning: 'bg-warning/[0.16] text-warning-ink font-semibold',
  neutral: 'bg-surface-3 text-ink-soft font-medium',
};

export function Badge({ variante = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-xs whitespace-nowrap',
        VARIANTES[variante],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
