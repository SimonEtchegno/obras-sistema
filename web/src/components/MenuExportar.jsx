import { useEffect, useRef, useState } from 'react';
import api from '../lib/api.js';
import { exportarExcel, exportarPDF } from '../lib/exportar.js';
import { Button } from './ui/index.js';
import { notificar } from './Dialogos.jsx';

function IconoChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

async function obtenerDatosExport(proyectoId) {
  const [arbol, listaAct, certificaciones] = await Promise.all([
    api.get(`/proyectos/${proyectoId}/items`),
    api.get(`/proyectos/${proyectoId}/actualizaciones-uocra`),
    api.get(`/proyectos/${proyectoId}/certificaciones`),
  ]);
  const actualizaciones = await Promise.all(
    listaAct.map((a) => api.get(`/actualizaciones-uocra/${a.id}`))
  );
  return { arbol, certificaciones, actualizaciones };
}

export function MenuExportar({ proyectoId, proyecto }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    if (abierto) document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  async function exportar(fn) {
    setAbierto(false);
    setCargando(true);
    try {
      const { arbol, certificaciones, actualizaciones } = await obtenerDatosExport(proyectoId);
      fn(proyecto, arbol, certificaciones, actualizaciones);
    } catch (e) {
      notificar('Error al exportar: ' + e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setAbierto((o) => !o)} cargando={cargando}>
        {cargando ? 'Exportando…' : 'Exportar'}
        {!cargando && <IconoChevron />}
      </Button>

      {abierto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-xl border border-line bg-surface shadow-card-md">
          <button
            onClick={() => exportar(exportarExcel)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
          >
            Excel (.xlsx)
          </button>
          <div className="mx-3 border-t border-gridline" />
          <button
            onClick={() => exportar(exportarPDF)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default MenuExportar;
