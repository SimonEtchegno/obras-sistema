import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtFecha, fmtMoney } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Subtitle, TopBar } from '../components/Layout.jsx';
import ProyectoTabs from '../components/ProyectoTabs.jsx';
import {
  Alert, Button, Card, Empty, ErrorAlert, Field, FieldRow, InputMonto, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';

function FilaEdicion({ fila, onCancelar, onGuardado }) {
  const [fecha, setFecha] = useState(fila.fecha);
  const [titulo, setTitulo] = useState(fila.titulo || '');
  const [monto, setMonto] = useState(String(Math.round(fila.monto_certificado)));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!fecha || !monto) {
      alert('Completá fecha y monto.');
      return;
    }
    setGuardando(true);
    try {
      await api.put(`/certificaciones/${fila.certificacion_id}`, {
        fecha,
        titulo: titulo.trim(),
        monto: parseFloat(monto) || 0,
      });
      onGuardado();
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
      setGuardando(false);
    }
  }

  return (
    <tr className="max-sm:block">
      <td colSpan={5} className="border-b border-gridline px-3 py-3 max-sm:block max-sm:px-0">
        <FieldRow>
          <Field
            className="min-w-[150px]"
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Field
            className="min-w-[170px] flex-[2]"
            label="Título"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <Field className="min-w-[150px] flex-1" label="Monto certificado">
            {(id) => <InputMonto id={id} className="w-full" value={monto} onChange={setMonto} />}
          </Field>
        </FieldRow>
        <div className="flex flex-wrap gap-2">
          <Button chico variante="primary" onClick={guardar} disabled={guardando}>
            Guardar
          </Button>
          <Button chico onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
        </div>
      </td>
    </tr>
  );
}

function FilaHistorial({ fila, recargar }) {
  const [editando, setEditando] = useState(false);

  async function borrar() {
    if (!confirm(`¿Borrar esta certificación de "${fila.item_nombre}"? Esta acción no se puede deshacer.`)) return;
    await api.del(`/certificaciones/${fila.certificacion_id}`);
    recargar();
  }

  return (
    <>
      <Tr>
        <Td label="Fecha">{fmtFecha(fila.fecha)}</Td>
        <Td label="Ítem afectado">{fila.item_nombre}</Td>
        <Td label="Título">{fila.titulo || ''}</Td>
        <Td label="Monto" num>
          {fmtMoney(fila.monto_certificado)}
        </Td>
        <Td label="Acciones" className="text-right">
          <div className="flex justify-end gap-2">
            <Button chico onClick={() => setEditando((a) => !a)}>
              Editar
            </Button>
            <Button chico variante="danger" onClick={borrar}>
              Borrar
            </Button>
          </div>
        </Td>
      </Tr>
      {editando && (
        <FilaEdicion
          fila={fila}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
          }}
        />
      )}
    </>
  );
}

export default function CertificacionesPage() {
  const { id } = useParams();
  // Los avisos de sobre-certificación llegan desde el botón "Certificar" del ítem.
  const avisos = useLocation().state?.avisos ?? [];

  const { datos, error, recargar } = useCargar(
    () =>
      Promise.all([api.get(`/proyectos/${id}`), api.get(`/proyectos/${id}/certificaciones`)]).then(
        ([proyecto, lista]) => ({ proyecto, lista })
      ),
    [id]
  );

  const proyecto = datos?.proyecto;
  const lista = datos?.lista ?? [];
  useTitulo(proyecto ? `Certificaciones — ${proyecto.nombre}` : 'Certificaciones — Sistema de Obras');

  return (
    <>
      <TopBar>
        <Crumb to="/">Proyectos</Crumb> / <Crumb to={`/proyecto/${id}`}>{proyecto ? proyecto.nombre : '…'}</Crumb> /
        Certificaciones
      </TopBar>
      <ProyectoTabs proyectoId={id} />

      <Container>
        <H1>Certificaciones</H1>
        <Subtitle>
          Historial de certificaciones cargadas. Para certificar un ítem, usá el botón "Certificar" en su tarjeta
          dentro de la solapa del proyecto.
        </Subtitle>

        <ErrorAlert error={error} />
        {avisos.map((aviso, i) => (
          <Alert key={i} variante="warning">
            ⚠ {aviso}
          </Alert>
        ))}

        <Card>
          <Table cards>
            <THead>
              <tr>
                <Th>Fecha</Th>
                <Th>Ítem afectado</Th>
                <Th>Título</Th>
                <Th num>Monto</Th>
                <Th className="w-[130px]" />
              </tr>
            </THead>
            <TBody>
              {lista.map((fila) => (
                <FilaHistorial key={fila.detalle_id} fila={fila} recargar={recargar} />
              ))}
            </TBody>
          </Table>

          {!lista.length && <Empty>Todavía no hay certificaciones cargadas.</Empty>}
        </Card>
      </Container>
    </>
  );
}
