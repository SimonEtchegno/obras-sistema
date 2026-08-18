import { NavLink } from 'react-router-dom';
import cx from '../lib/cx.js';

const CLASES_BASE =
  'inline-block border-b-2 px-4 py-[13px] text-sm font-medium transition-colors max-sm:px-3 max-sm:whitespace-nowrap';

function Tab({ to, end = false, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          CLASES_BASE,
          isActive
            ? 'border-accent font-semibold text-accent'
            : 'border-transparent text-ink-soft hover:text-ink'
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function ProyectoTabs({ proyectoId }) {
  return (
    <div className="glass-blur sticky top-[58px] z-[9] flex gap-1 border-b border-glass-line bg-glass-2 px-8 max-sm:top-[54px] max-sm:overflow-x-auto max-sm:px-2">
      <Tab to={`/proyecto/${proyectoId}`} end>
        Resumen
      </Tab>
      <Tab to={`/proyecto/${proyectoId}/certificaciones`}>Certificaciones</Tab>
      <Tab to={`/proyecto/${proyectoId}/uocra`}>Actualizaciones UOCRA</Tab>
    </div>
  );
}

export default ProyectoTabs;
