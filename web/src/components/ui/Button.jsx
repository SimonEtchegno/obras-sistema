import cx from '../../lib/cx.js';
import { Spinner } from './LoadingOverlay.jsx';

const VARIANTES = {
  normal: 'border-line-strong bg-surface text-ink hover:bg-surface-3',
  primary: 'border-accent bg-accent text-accent-ink font-semibold shadow-card hover:brightness-[1.07]',
  danger: 'border-line bg-surface text-critical hover:bg-critical/[0.08] hover:border-critical/30',
};

// El radio y el padding dependen de la combinación variante/tamaño, así que se
// eligen acá: dos utilidades de Tailwind para la misma propiedad se pisarían
// entre sí de forma imprevisible.
function radio(variante, chico) {
  if (variante === 'primary') return 'rounded-full';
  return chico ? 'rounded-[7px]' : 'rounded-ctl';
}

function espaciado(variante, chico) {
  if (chico) return variante === 'primary' ? 'px-3.5 py-1.5' : 'px-[11px] py-1.5';
  return variante === 'primary' ? 'px-[18px] py-[9px]' : 'px-4 py-[9px]';
}

// `cargando` deshabilita el botón y le pone el Spinner adelante del texto,
// para no dejar los guardados sin ningún indicio de que están en curso.
export function Button({
  variante = 'normal',
  chico = false,
  cargando = false,
  disabled,
  className,
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 border font-medium transition-[background-color,border-color,filter,transform] duration-150',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-[38px]',
        VARIANTES[variante],
        radio(variante, chico),
        espaciado(variante, chico),
        chico && 'text-[13px]',
        className
      )}
      {...props}
    >
      {cargando && <Spinner className={chico ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {children}
    </button>
  );
}

export default Button;
