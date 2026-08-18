import { createContext, useContext } from 'react';
import cx from '../../lib/cx.js';

// Con cards={true} la tabla se convierte en tarjetas apiladas en pantallas
// chicas en vez de pedir scroll lateral: cada celda pasa a ser una fila
// "etiqueta / valor", usando el label que recibe cada <Td>. Se usa en las
// tablas principales; las tablas de detalle quedan como tabla con scroll.
const ModoCards = createContext(false);

export function Table({ cards = false, className, children }) {
  return (
    <ModoCards.Provider value={cards}>
      <div className="overflow-x-auto">
        <table className={cx('w-full border-collapse text-sm', cards && 'max-sm:block', className)}>{children}</table>
      </div>
    </ModoCards.Provider>
  );
}

export function THead({ className, children }) {
  const cards = useContext(ModoCards);
  return <thead className={cx(cards && 'max-sm:hidden', className)}>{children}</thead>;
}

export function TBody({ className, children }) {
  const cards = useContext(ModoCards);
  return <tbody className={cx(cards && 'max-sm:block', className)}>{children}</tbody>;
}

export function Tr({ className, children, ...props }) {
  const cards = useContext(ModoCards);
  return (
    <tr
      className={cx(
        'hover:bg-surface-2',
        cards &&
          'max-sm:mb-2.5 max-sm:block max-sm:rounded-ctl max-sm:border max-sm:border-line max-sm:bg-surface-2 max-sm:px-3.5 max-sm:py-1 max-sm:last:mb-0',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Th({ num = false, className, children, ...props }) {
  return (
    <th
      className={cx(
        'border-b border-gridline px-3 py-3 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft',
        num ? 'text-right' : 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ label, num = false, className, children, ...props }) {
  const cards = useContext(ModoCards);
  return (
    <td
      data-label={label}
      className={cx(
        'border-b border-gridline px-3 py-3 text-left align-middle max-sm:text-[13.5px]',
        num && 'text-right tabular-nums',
        cards &&
          'max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:px-0 max-sm:py-2.5 max-sm:text-right max-sm:last:border-b-0',
        cards &&
          'max-sm:before:text-left max-sm:before:text-[11.5px] max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-[0.04em] max-sm:before:text-ink-soft max-sm:before:content-[attr(data-label)]',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export default Table;
