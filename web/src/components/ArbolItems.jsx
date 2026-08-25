import { useId, useState } from 'react';
import api from '../lib/api.js';
import cx from '../lib/cx.js';
import { fmtFecha, fmtMoney, fmtPct, hoyIso } from '../lib/format.js';
import { Badge, Button, Card, Empty, Input, InputMonto, Label, Meter } from './ui/index.js';

function sumaPorcentajeHijos(nodo) {
  return nodo.hijos.reduce((acc, h) => acc + (Number(h.porcentaje) || 0), 0);
}

// Avisos de consistencia: los organizativos avisan si el reparto de % de sus
// hijos no da 100, y los finales si quedaron sobre-certificados.
function Avisos({ item }) {
  if (!item.esHoja) {
    const suma = sumaPorcentajeHijos(item);
    if (Math.abs(suma - 100) > 0.5) {
      return (
        <Badge variante="warning" title="La suma de % de los sub-ítems no da 100%">
          ⚠ {suma.toFixed(1)}% repartido
        </Badge>
      );
    }
    return null;
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

// El % ya no se pide: los sub-ítems se reparten el 100% del padre en partes
// iguales entre todos los hermanos, recalculado por el servidor al agregar.
export function FormItem({ etiquetaNombre, onAgregar }) {
  const idBase = useId();
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await onAgregar({ nombre: nombre.trim() });
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
      <Button variante="primary" onClick={agregar} disabled={guardando}>
        Agregar
      </Button>
    </div>
  );
}

function FormCertificar({ inicial, textoBoton = 'Certificar', onCertificar, onCancelar }) {
  const idBase = useId();
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyIso());
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [monto, setMonto] = useState(inicial?.monto ?? '');
  const [guardando, setGuardando] = useState(false);

  async function certificar() {
    if (!fecha) {
      alert('Falta la fecha.');
      return;
    }
    if (!monto) {
      alert('Falta el monto certificado.');
      return;
    }
    setGuardando(true);
    try {
      await onCertificar({ fecha, titulo: titulo.trim(), monto: parseFloat(monto) || 0 });
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div className="min-w-[150px]">
        <Label htmlFor={`${idBase}-fecha`}>Fecha</Label>
        <Input
          id={`${idBase}-fecha`}
          className="w-full"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <div className="min-w-[170px] flex-[2]">
        <Label htmlFor={`${idBase}-titulo`}>Título</Label>
        <Input
          id={`${idBase}-titulo`}
          className="w-full"
          type="text"
          placeholder="Ej: Certificación julio 2025"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && certificar()}
        />
      </div>
      <div className="min-w-[150px] flex-1">
        <Label htmlFor={`${idBase}-monto`}>Monto certificado</Label>
        <InputMonto id={`${idBase}-monto`} className="w-full" value={monto} onChange={setMonto} />
      </div>
      <Button variante="primary" onClick={certificar} disabled={guardando}>
        {textoBoton}
      </Button>
      {onCancelar && (
        <Button onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
      )}
    </div>
  );
}

function FilaCertificacionItem({ cert, recargar }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="rounded-ctl bg-surface-3 px-3 py-3">
        <FormCertificar
          inicial={{ fecha: cert.fecha, titulo: cert.titulo || '', monto: String(Math.round(cert.monto_certificado)) }}
          textoBoton="Guardar"
          onCancelar={() => setEditando(false)}
          onCertificar={async ({ fecha, titulo, monto }) => {
            await api.put(`/certificaciones/${cert.certificacion_id}`, { fecha, titulo, monto });
            setEditando(false);
            recargar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-surface-2 px-3.5 py-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5">
      <span className="w-[92px] shrink-0 text-[12.5px] tabular-nums text-ink-muted max-sm:w-auto">
        {fmtFecha(cert.fecha)}
      </span>
      <span
        className="min-w-[120px] flex-1 truncate text-[14px] text-ink max-sm:whitespace-normal"
        title={cert.titulo || undefined}
      >
        {cert.titulo || <span className="text-ink-muted">Sin título</span>}
      </span>
      <span className="w-[130px] shrink-0 text-right text-[14.5px] font-semibold tabular-nums text-ink max-sm:w-auto max-sm:text-left">
        {fmtMoney(cert.monto_certificado)}
      </span>
      <Button chico onClick={() => setEditando(true)}>
        Editar
      </Button>
    </div>
  );
}

function CertificacionesItem({ certificaciones, recargar }) {
  if (!certificaciones.length) return null;
  return (
    <div className="mt-4 border-t border-dashed border-gridline pt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        {certificaciones.length > 1 ? 'Certificaciones cargadas' : 'Certificación cargada'}
      </div>
      <div className="flex flex-col gap-1.5">
        {certificaciones.map((cert) => (
          <FilaCertificacionItem key={cert.detalle_id} cert={cert} recargar={recargar} />
        ))}
      </div>
    </div>
  );
}

function TarjetaItem({ item, proyectoId, certificaciones, recargar }) {
  const [editando, setEditando] = useState(false);
  const [subitemAbierto, setSubitemAbierto] = useState(false);
  const [certificarAbierto, setCertificarAbierto] = useState(false);
  const [nombre, setNombre] = useState(item.nombre);

  function abrirEdicion() {
    setNombre(item.nombre);
    setEditando(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      alert('El ítem necesita un nombre.');
      return;
    }
    try {
      await api.put(`/items/${item.id}`, { nombre: nombre.trim() });
      setEditando(false);
      recargar();
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    }
  }

  async function certificarItem({ fecha, titulo, monto }) {
    const resultado = await api.post(`/proyectos/${proyectoId}/certificaciones`, {
      fecha,
      descripcion: titulo,
      detalles: [{ item_id: item.id, monto_certificado: monto }],
    });
    if (resultado?.avisos?.length) alert(resultado.avisos.join('\n'));
    setCertificarAbierto(false);
    recargar();
  }

  async function borrar() {
    if (!confirm(`¿Eliminar "${item.nombre}"? Esto borra también su historial de certificaciones y actualizaciones UOCRA. No se puede deshacer.`)) return;
    try {
      await api.del(`/items/${item.id}`);
      recargar();
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message);
    }
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
              <StatValor>{fmtPct(item.porcentaje)}</StatValor>
            </Stat>
            <Stat label="Monto">
              <StatValor>{fmtMoney(item.monto_base)}</StatValor>
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
              {item.esHoja && (
                <Button chico variante="primary" onClick={() => setCertificarAbierto((abierto) => !abierto)}>
                  Certificar
                </Button>
              )}
              {!!item.permite_subitems && (
                <Button chico onClick={() => setSubitemAbierto((abierto) => !abierto)}>
                  + Subítem
                </Button>
              )}
              {!item.fijo && (
                <Button chico onClick={abrirEdicion}>
                  Editar
                </Button>
              )}
              {!item.fijo && (
                <Button chico variante="danger" onClick={borrar}>
                  Borrar
                </Button>
              )}
            </div>
          </div>

          <StatsGrid>
            <Stat label="%">
              <StatValor>{fmtPct(item.porcentaje)}</StatValor>
            </Stat>
            <Stat label="Monto">
              <StatValor>{fmtMoney(item.monto_base)}</StatValor>
            </Stat>
            <StatsCalculadas item={item} />
          </StatsGrid>
        </>
      )}

      {item.esHoja && (
        <CertificacionesItem
          certificaciones={certificaciones.filter((c) => c.item_id === item.id)}
          recargar={recargar}
        />
      )}

      {certificarAbierto && (
        <div className="mt-4 border-t border-dashed border-gridline pt-4">
          <FormCertificar onCertificar={certificarItem} />
        </div>
      )}

      {subitemAbierto && (
        <div className="mt-4 border-t border-dashed border-gridline pt-4">
          <FormItem
            etiquetaNombre="Nombre del sub-ítem"
            onAgregar={async ({ nombre: nuevoNombre }) => {
              await api.post(`/proyectos/${proyectoId}/items`, {
                nombre: nuevoNombre,
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

function Nodo({ item, esRaiz, proyectoId, certificaciones, recargar }) {
  return (
    <div className={esRaiz ? '' : 'border-l-2 border-gridline pl-5 max-sm:pl-3'}>
      <TarjetaItem item={item} proyectoId={proyectoId} certificaciones={certificaciones} recargar={recargar} />
      {item.hijos && item.hijos.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-3.5">
          {item.hijos.map((hijo) => (
            <Nodo
              key={hijo.id}
              item={hijo}
              proyectoId={proyectoId}
              certificaciones={certificaciones}
              recargar={recargar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArbolItems({ raices, proyectoId, certificaciones = [], recargar }) {
  if (!raices.length) {
    return <Empty>Este proyecto todavía no tiene ítems.</Empty>;
  }
  return (
    <div className="flex flex-col gap-3.5">
      {raices.map((raiz) => (
        <Nodo
          key={raiz.id}
          item={raiz}
          esRaiz
          proyectoId={proyectoId}
          certificaciones={certificaciones}
          recargar={recargar}
        />
      ))}
    </div>
  );
}

export default ArbolItems;
