import { useId, useState } from 'react';
import api from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import { Button, Card, Empty, ErrorAlert, Input, InputMonto, Label } from './ui/index.js';

// Alta y edición comparten el mismo formulario: título (o descripción) y
// monto. Con `inicial` viene precargado para editar.
function FormExtra({ inicial, textoBoton = 'Agregar', onGuardar, onCancelar }) {
  const idBase = useId();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [monto, setMonto] = useState(inicial ? String(Math.round(inicial.monto)) : '');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!titulo.trim()) {
      alert('El extra necesita un título.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ titulo: titulo.trim(), monto: parseFloat(monto) || 0 });
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div className="min-w-[200px] flex-[2]">
        <Label htmlFor={`${idBase}-titulo`}>Título o descripción</Label>
        <Input
          id={`${idBase}-titulo`}
          className="w-full"
          type="text"
          placeholder="Ej: Provisión de artefactos adicionales"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
      </div>
      <div className="min-w-[150px] flex-1">
        <Label htmlFor={`${idBase}-monto`}>Monto</Label>
        <InputMonto id={`${idBase}-monto`} className="w-full" value={monto} onChange={setMonto} />
      </div>
      <Button variante="primary" onClick={guardar} disabled={guardando}>
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

function FilaExtra({ extra, recargar }) {
  const [editando, setEditando] = useState(false);

  async function borrar() {
    if (!confirm(`¿Borrar el extra "${extra.titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/extras/${extra.id}`);
      recargar();
    } catch (err) {
      alert('No se pudo borrar: ' + err.message);
    }
  }

  if (editando) {
    return (
      <div className="rounded-ctl bg-surface-3 px-3 py-3">
        <FormExtra
          inicial={extra}
          textoBoton="Guardar"
          onCancelar={() => setEditando(false)}
          onGuardar={async (cambios) => {
            await api.put(`/extras/${extra.id}`, cambios);
            setEditando(false);
            recargar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-surface-2 px-3.5 py-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5">
      <span className="min-w-[120px] flex-1 text-[14px] text-ink max-sm:whitespace-normal" title={extra.titulo}>
        {extra.titulo}
      </span>
      <span className="w-[130px] shrink-0 text-right text-[14.5px] font-semibold tabular-nums text-ink max-sm:w-auto max-sm:text-left">
        {fmtMoney(extra.monto)}
      </span>
      <div className="flex gap-2 max-sm:[&>button]:flex-1">
        <Button chico onClick={() => setEditando(true)}>
          Editar
        </Button>
        <Button chico variante="danger" onClick={borrar}>
          Borrar
        </Button>
      </div>
    </div>
  );
}

// Los extras se cargan y recargan por su cuenta: no afectan los montos del
// proyecto, así que no hace falta refrescar toda la pantalla al tocarlos.
export function Extras({ proyectoId }) {
  const { datos, error, recargar } = useCargar(() => api.get(`/proyectos/${proyectoId}/extras`), [proyectoId]);
  const [agregando, setAgregando] = useState(false);

  const extras = datos?.extras ?? [];
  const total = datos?.total ?? 0;

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <span className="flex-[1_1_220px] text-[15.5px] font-semibold">Extras</span>
        <div className="ml-auto flex gap-2 max-sm:ml-0 max-sm:w-full max-sm:[&>button]:flex-1">
          <Button chico variante="primary" onClick={() => setAgregando((abierto) => !abierto)}>
            + Extra
          </Button>
        </div>
      </div>

      <p className="mb-4 text-[13px] text-ink-muted">
        Detalles que se registran aparte del presupuesto: no modifican el monto total ni el de ningún ítem.
      </p>

      <ErrorAlert error={error} />

      {extras.length ? (
        <>
          <div className="flex flex-col gap-1.5">
            {extras.map((extra) => (
              <FilaExtra key={extra.id} extra={extra} recargar={recargar} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-gridline pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Total extras</span>
            <span className="text-[15px] font-semibold tabular-nums text-ink">{fmtMoney(total)}</span>
          </div>
        </>
      ) : (
        <Empty>Todavía no hay extras cargados.</Empty>
      )}

      {agregando && (
        <div className="mt-4 border-t border-dashed border-gridline pt-4">
          <FormExtra
            onGuardar={async (nuevo) => {
              await api.post(`/proyectos/${proyectoId}/extras`, nuevo);
              setAgregando(false);
              recargar();
            }}
          />
        </div>
      )}
    </Card>
  );
}

export default Extras;
