import cx from '../../lib/cx.js';
import Card from './Card.jsx';

export function KpiRow({ children }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5 max-sm:grid-cols-2 max-sm:gap-2.5 max-[420px]:grid-cols-1">
      {children}
    </div>
  );
}

export function KpiTile({ icono, label, valor, acento = false }) {
  return (
    <Card className="flex items-start gap-3.5 px-[22px] py-5 max-sm:gap-2.5 max-sm:px-4 max-sm:py-3.5">
      <span
        className={cx(
          'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] max-sm:h-8 max-sm:w-8',
          '[&_svg]:h-[19px] [&_svg]:w-[19px] max-sm:[&_svg]:h-4 max-sm:[&_svg]:w-4',
          acento ? 'bg-accent-wash text-accent' : 'bg-surface-3 text-ink-soft'
        )}
      >
        {icono}
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 text-[13px] text-ink-soft">{label}</div>
        <div className={cx('text-[22px] font-semibold tracking-[-0.01em] max-sm:text-lg', acento && 'text-accent')}>
          {valor}
        </div>
      </div>
    </Card>
  );
}

export default KpiTile;
