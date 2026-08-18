import cx from '../../lib/cx.js';

const VARIANTES = {
  warning: 'bg-warning/[0.14] text-warning-ink border-warning/40',
  error: 'bg-critical/[0.08] text-critical border-critical/25',
};

export function Alert({ variante = 'error', className, children }) {
  return (
    <div className={cx('mb-[18px] rounded-ctl border px-4 py-3 text-sm', VARIANTES[variante], className)}>
      {children}
    </div>
  );
}

// Muestra el .message de un Error del api, con el mismo formato que el resto.
export function ErrorAlert({ error }) {
  if (!error) return null;
  return <Alert variante="error">{error.message || String(error)}</Alert>;
}

export default Alert;
