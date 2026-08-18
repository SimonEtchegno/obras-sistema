import cx from '../../lib/cx.js';
import { fmtPct } from '../../lib/format.js';

// Barra de avance certificado. Si pasa del 100% se pinta en rojo, pero la
// barra se corta en 100 para que no se desborde.
export function Meter({ pct, className }) {
  const valor = Number(pct) || 0;
  const acotado = Math.max(0, Math.min(100, valor));
  const excedido = valor > 100;

  return (
    <div className={cx('flex items-center gap-3', className)} title={`${fmtPct(valor)} certificado`}>
      <div className="h-[9px] flex-1 overflow-hidden rounded-[5px] bg-accent-track">
        <div
          className={cx('h-full rounded-[5px] transition-[width] duration-[250ms]', excedido ? 'bg-critical' : 'bg-accent')}
          style={{ width: `${acotado}%` }}
        />
      </div>
      <div className="min-w-[46px] text-right text-[13px] font-medium tabular-nums text-ink-soft">{fmtPct(valor)}</div>
    </div>
  );
}

export default Meter;
