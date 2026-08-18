import cx from '../../lib/cx.js';

// Superficie "glass" del sistema: fondo translúcido + desenfoque de lo que
// pasa por detrás. Es la base de las tarjetas, los KPI y los ítems del árbol.
export function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag
      className={cx(
        'glass-blur rounded-card border border-glass-line bg-glass shadow-card',
        'px-7 py-[26px] max-sm:px-4 max-sm:py-[18px]',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Card;
