import cx from '../lib/cx.js';
import { fmtMoney } from '../lib/format.js';

// Compara el presupuesto original contra el vigente (que ya incluye los
// aumentos UOCRA aplicados). Dos barras sobre el mismo eje: la original en
// gris de base, la vigente en el acento — así se ve de un vistazo cuánto
// infló el proyecto, sin tener que restar dos números de cabeza.
function Barra({ label, monto, pct, base }) {
  return (
    <div
      className="grid grid-cols-[72px_1fr_auto] items-center gap-3 max-[480px]:grid-cols-[60px_1fr]"
      title={`${label}: ${fmtMoney(monto)}`}
    >
      <div className="text-[13px] font-medium text-ink-soft">{label}</div>
      <div className="h-3.5 overflow-hidden rounded-[7px] bg-surface-3">
        <div
          className={cx('h-full rounded-[7px] transition-[width] duration-[250ms]', base ? 'bg-ink-muted opacity-45' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="min-w-[118px] text-right text-sm font-semibold tabular-nums max-[480px]:col-start-2 max-[480px]:min-w-0 max-[480px]:text-left">
        {fmtMoney(monto)}
      </div>
    </div>
  );
}

export function ComparacionPresupuesto({ original, vigente }) {
  const max = Math.max(original, vigente, 1);
  const delta = vigente - original;
  const deltaPct = original > 0 ? (delta / original) * 100 : 0;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Barra label="Original" monto={original} pct={(original / max) * 100} base />
        <Barra label="Vigente" monto={vigente} pct={(vigente / max) * 100} />
      </div>

      {Math.abs(delta) < 0.5 ? (
        <p className="mt-1 text-[13px] text-ink-muted">
          Sin actualizaciones UOCRA todavía — el monto vigente es igual al presupuesto original.
        </p>
      ) : delta > 0 ? (
        <p className="mt-1 text-[13px] text-ink-soft">
          Aumentó <b className="text-ink">{fmtMoney(delta)}</b> (+{deltaPct.toFixed(1)}%) sobre el presupuesto original,
          por actualizaciones UOCRA.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-soft">
          El monto vigente quedó <b className="text-ink">{fmtMoney(Math.abs(delta))}</b> por debajo del presupuesto
          original.
        </p>
      )}
    </>
  );
}

export default ComparacionPresupuesto;
