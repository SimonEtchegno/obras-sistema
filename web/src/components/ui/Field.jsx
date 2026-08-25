import { useId } from 'react';
import cx from '../../lib/cx.js';

export function Label({ className, children, ...props }) {
  return (
    <label className={cx('mb-1.5 block text-[13px] font-medium text-ink-soft', className)} {...props}>
      {children}
    </label>
  );
}

// Sin ancho propio a propósito: cada uso lo define (w-full dentro de un
// Field, ancho fijo en las celdas de las tablas de carga). Dos utilidades de
// ancho sobre el mismo elemento se pisarían de forma imprevisible.
export function Input({ className, ...props }) {
  return (
    <input
      className={cx(
        'rounded-ctl border border-line-strong bg-surface px-[11px] py-[9px] text-ink',
        'transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted',
        'focus:border-accent focus:ring-3 focus:ring-accent-wash focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

// Input de montos en pesos: mientras se escribe se ve con el separador de
// miles "." como se usa en Argentina (ej. "1.000.000"), pero el valor que
// entra y sale por value/onChange es siempre el número puro sin puntos, para
// no tener que tocar la lógica de los formularios que lo usan.
export function InputMonto({ value, onChange, className, ...props }) {
  const soloDigitos = String(value ?? '').replace(/\D/g, '');
  const formateado = soloDigitos ? Number(soloDigitos).toLocaleString('es-AR') : '';

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={formateado}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      className={className}
      {...props}
    />
  );
}

// Etiqueta + control, con el <label for> ya cableado al input. Sin children
// arma un <Input> con los props que reciba; con children (o una función que
// recibe el id) sirve para cualquier otro control.
export function Field({ label, className, children, ...props }) {
  const id = useId();
  let control;
  if (typeof children === 'function') control = children(id);
  else if (children) control = children;
  else control = <Input id={id} className="w-full" {...props} />;

  return (
    <div className={cx('mb-4', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {control}
    </div>
  );
}

export function FieldRow({ className, children }) {
  return <div className={cx('flex flex-wrap gap-4 max-sm:flex-col max-sm:gap-0', className)}>{children}</div>;
}

export default Field;
