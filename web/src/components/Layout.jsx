import { Link } from 'react-router-dom';
import cx from '../lib/cx.js';
import { IconoObra } from './Icons.jsx';

export function TopBar({ children }) {
  return (
    <div className="glass-blur sticky top-0 z-10 flex items-center gap-3 border-b border-white/12 bg-topbar px-8 py-4 max-sm:px-4 max-sm:py-3">
      <span className="flex items-center gap-2.5 text-base font-bold tracking-[-0.01em] text-white max-[420px]:text-[14.5px]">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-white/16 text-white [&_svg]:h-[15px] [&_svg]:w-[15px]">
          <IconoObra />
        </span>
        Sistema de Obras
      </span>
      {children && <span className="text-sm text-white/70 max-sm:text-[12.5px]">{children}</span>}
    </div>
  );
}

// Migas de pan: los links van en el mismo tono translúcido que el resto de la
// barra y se aclaran al pasar el mouse.
export function Crumb({ to, children }) {
  return (
    <Link to={to} className="text-white/70 hover:text-white hover:underline">
      {children}
    </Link>
  );
}

export function Container({ className, children }) {
  return (
    <div className={cx('mx-auto max-w-[1140px] px-8 pt-9 pb-16 max-sm:px-4 max-sm:pt-5 max-sm:pb-12', className)}>
      {children}
    </div>
  );
}

export function Toolbar({ className, children }) {
  return (
    <div
      className={cx(
        'mb-[18px] flex flex-wrap items-center justify-between gap-3.5 max-sm:flex-col max-sm:items-stretch',
        className
      )}
    >
      {children}
    </div>
  );
}

export function H1({ className, children }) {
  return (
    <h1 className={cx('mb-1.5 text-[26px] font-bold tracking-[-0.015em] max-sm:text-[21px] max-[420px]:text-[19px]', className)}>
      {children}
    </h1>
  );
}

export function Subtitle({ className, children }) {
  return <p className={cx('mb-6 text-sm leading-relaxed text-ink-soft', className)}>{children}</p>;
}

// h2 con el cuadradito de acento adelante, como el ::before del CSS original.
export function SectionTitle({ className, children }) {
  return (
    <h2 className={cx('mb-4 flex items-center gap-[9px] text-[17px] font-semibold tracking-[-0.01em]', className)}>
      <span className="h-[9px] w-[9px] shrink-0 rounded-[3px] bg-accent" />
      {children}
    </h2>
  );
}

export function Section({ className, children }) {
  return <div className={cx('mb-9 last:mb-0', className)}>{children}</div>;
}
