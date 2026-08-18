import { useId, useState } from 'react';
import api from '../lib/api.js';
import cx from '../lib/cx.js';
import { fmtMoney, fmtPct } from '../lib/format.js';
import { Badge, Button, Card, Empty, Input, Label, Meter } from './ui/index.js';

function sumaPorcentajeHijos(nodo) {
  return nodo.hijos.reduce((acc, h) => acc + (Number(h.porcentaje) || 0), 0);
}

// Avisos de consistencia: los organizativos avisan si el reparto de % de sus
// hijos no da 100, y los finales si quedaron sobre-certificados.
function Avisos({ item }) {
  if (!item.esHoja) {
    const suma = sumaPorcentajeHijos(item);
    return (
      <>
        {Math.abs(suma - 100) > 0.5 && (
          <Badge variante="warning" title="La suma de % de los sub-ítems no da 100%">
            ⚠ {suma.toFixed(1)}% repartido
          </Badge>
        )}
        <Badge>organizativo</Badge>
      </>
    );
  }
  if (item.porcentaje_avance > 100.5) {
    return (
      <Badge variante="warning" title="Este ítem tiene más certificado que su monto vigente">
        ⚠ {fmtPct(item.porcentaje_avance)} certificado
      </Badge>
    );
  }
  return null;
}

function StatsGrid({ children }) {
  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-x-[26px] gap-y-[18px] border-t border-gridline pt-4 max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3.5">
      {children}
    </div>
  );
}

function Stat({ label, className, children }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function StatValor({ children }) {
  return <span className="flex items-center gap-2 text-[15px] font-semibold tabular-nums text-ink">{children}</span>;
}

// Estadísticas que se muestran igual en modo lectura y en modo edición: son
// calculadas, no editables.
function StatsCalculadas({ item }) {
  return (
    <>
      <Stat label="Vigente">
        <StatValor>{fmtMoney(item.monto_vigente)}</StatValor>
      </Stat>
      <Stat label="Certificado">
        <StatValor>{fmtMoney(item.certificado_acumulado)}</StatValor>
      </Stat>
      <Stat label="Saldo">
        <StatValor>{fmtMoney(item.saldo_pendiente)}</StatValor>
      </Stat>
      <Stat label="Avance" className="min-w-[150px]">
        <Meter pct={item.porcentaje_avance} />
      </Stat>
    </>
  );
}

export function FormItem({ etiquetaNombre, etiquetaPorcentaje, onAgregar }) {
  const idBase = useId();
  const [nombre, setNombre] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await onAgregar({ nombre: nombre.trim(), porcentaje: parseFloat(porcentaje) || 0 });
    } catch (err) {
      alert('No se pudo agregar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div className="min-w-[170px] flex-[2]">
        <Label htmlFor={`${idBase}-nombre`}>{etiquetaNombre}</Label>
        <Input
          id={`${idBase}-nombre`}
          className="w-full"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
      </div>
      <div className="min-w-[120px] flex-1">
        <Label htmlFor={`${idBase}-pct`}>{etiquetaPorcentaje}</Label>
        <Input
          id={`${idBase}-pct`}
          className="w-full"
          type="number"
          step="0.01"
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
      </div>
      <Button variante="primary" onClick={agregar} disabled={guardando}>
        Agregar
      </Button>
    </div>
  );
}

function TarjetaItem({ item, proyectoId, recargar }) {
  const [editando, setEditando] = useState(false);
  const [subitemAbierto, setSubitemAbierto] = useState(false);
  const [nombre, setNombre] = useState(item.nombre);
  const [porcentaje, setPorcentaje] = useState(String(item.porcentaje));
  const [manual, setManual] = useState(!!item.monto_base_manual);
  const [montoBase, setMontoBase] = useState(String(Math.round(item.monto_base)));

  function abrirEdicion() {
    setNombre(item.nombre);
    setPorcentaje(String(item.porcentaje));
    setManual(!!item.monto_base_manual);
    setMontoBase(String(Math.round(item.monto_base)));
    setEditando(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      alert('El ítem necesita un nombre.');
      return;
    }
    const cambios = {
      nombre: nombre.trim(),
      porcentaje: parseFloat(porcentaje) || 0,
      monto_base_manual: manual,
    };
    if (manual) cambios.monto_base = parseFloat(montoBase) || 0;
    try {
      await api.put(`/items/${item.id}`, cambios);
      setEditando(false);
      recargar();
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    }
  }

  async function archivar() {
    if (!confirm(`¿Archivar "${item.nombre}"? Se oculta de la lista pero no se borra su historial.`)) return;
    await api.patch(`/items/${item.id}/archivar`);
    recargar();
  }

  return (
    <Card
      className={cx(
        'px-[22px] py-5 transition-[box-shadow,border-color] duration-150 hover:shadow-card-md',
        !item.esHoja && 'bg-glass-2'
      )}
    >
      {editando ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              className="-ml-2 min-w-[180px] flex-[1_1_220px] rounded-ctl border border-transparent bg-transparent px-2 py-1.5 text-[15.5px] font-semibold text-ink hover:bg-surface-3 focus:border-line-strong focus:bg-surface focus:ring-3 focus:ring-accent-wash focus:outline-none"
            />
            <div className="ml-auto flex gap-2 max-sm:ml-0 max-sm:w-full max-sm:[&>button]:flex-1">
              <Button chico variante="primary" onClick={guardar}>
                Guardar
              </Button>
              <Button chico onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </div>

          <StatsGrid>
            <Stat label="%">
              <Input
                type="number"
                step="0.01"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                className="w-full max-w-[130px]"
              />
            </Stat>
            <Stat
              label={
                <>
                  Monto
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-normal normal-case tracking-normal text-ink-soft">
                    <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> manual
                  </span>
                </>
              }
            >
              <Input
                type="number"
                step="1"
                value={montoBase}
                disabled={!manual}
                onChange={(e) => setMontoBase(e.target.value)}
                className="w-full max-w-[130px]"
              />
            </Stat>
            <StatsCalculadas item={item} />
          </StatsGrid>
        </>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <span className="-ml-2 flex-[1_1_220px] px-2 py-1.5 text-[15.5px] font-semibold">{item.nombre}</span>
            <Avisos item={item} />
            <div className="ml-auto flex gap-2 max-sm:ml-0 max-sm:w-full max-sm:[&>button]:flex-1">
              <Button chico onClick={() => setSubitemAbierto((abierto) => !abierto)}>
                + Subítem
              </Button>
              <Button chico onClick={abrirEdicion}>
                Editar
              </Button>
              <Button chico variante="danger" onClick={archivar}>
                Archivar
              </Button>
            </div>
          </div>

          <StatsGrid>
            <Stat label="%">
              <StatValor>{item.porcentaje}%</StatValor>
            </Stat>
            <Stat label="Monto">
              <StatValor>
                {fmtMoney(item.monto_base)}
                {item.monto_base_manual ? <Badge>manual</Badge> : null}
              </StatValor>
            </Stat>
            <StatsCalculadas item={item} />
          </StatsGrid>
        </>
      )}

      {subitemAbierto && (
        <div className="mt-4 border-t border-dashed border-gridline pt-4">
          <FormItem
            etiquetaNombre="Nombre del sub-ítem"
            etiquetaPorcentaje="% del monto de este ítem"
            onAgregar={async ({ nombre: nuevoNombre, porcentaje: nuevoPct }) => {
              await api.post(`/proyectos/${proyectoId}/items`, {
                nombre: nuevoNombre,
                porcentaje: nuevoPct,
                parent_id: item.id,
              });
              setSubitemAbierto(false);
              recargar();
            }}
          />
        </div>
      )}
    </Card>
  );
}

function Nodo({ item, esRaiz, proyectoId, recargar }) {
  return (
    <div className={esRaiz ? '' : 'border-l-2 border-gridline pl-5 max-sm:pl-3'}>
      <TarjetaItem item={item} proyectoId={proyectoId} recargar={recargar} />
      {item.hijos && item.hijos.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-3.5">
          {item.hijos.map((hijo) => (
            <Nodo key={hijo.id} item={hijo} proyectoId={proyectoId} recargar={recargar} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArbolItems({ raices, proyectoId, recargar }) {
  if (!raices.length) {
    return <Empty>No hay ítems todavía. Agregá el primero con "+ Nuevo ítem raíz".</Empty>;
  }
  return (
    <div className="flex flex-col gap-3.5">
      {raices.map((raiz) => (
        <Nodo key={raiz.id} item={raiz} esRaiz proyectoId={proyectoId} recargar={recargar} />
      ))}
    </div>
  );
}

export default ArbolItems;
