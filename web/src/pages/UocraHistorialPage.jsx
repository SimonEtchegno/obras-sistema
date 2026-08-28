import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtFecha, fmtMoney, fmtPct, fmtTipoActualizacion } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Toolbar, TopBar } from '../components/Layout.jsx';
import ProyectoTabs from '../components/ProyectoTabs.jsx';
import MenuExportar from '../components/MenuExportar.jsx';
import { Button, Card, Empty, ErrorAlert, LoadingOverlay, Table, TBody, Td, Th, THead, Tr } from '../components/ui/index.js';
import { confirmar, notificar } from '../components/Dialogos.jsx';

function DetalleActualizacion({ efectos }) {
  return (
    <Table className="my-1.5">
      <THead>
        <tr>
          <Th>Ítem</Th>
          <Th num>Saldo antes</Th>
          <Th num>Ajuste</Th>
          <Th num>Vigente después</Th>
        </tr>
      </THead>
      <TBody>
        {efectos.map((e) => (
          <Tr key={e.id}>
            <Td>{e.item_nombre}</Td>
            <Td num>{fmtMoney(e.saldo_pendiente_antes)}</Td>
            <Td num>+{fmtMoney(e.monto_ajuste)}</Td>
            <Td num>{fmtMoney(e.monto_vigente_despues)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function FilaActualizacion({ actualizacion, recargar }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null);

  async function alternarDetalle() {
    if (!abierto && !detalle) {
      setDetalle(await api.get(`/actualizaciones-uocra/${actualizacion.id}`));
    }
    setAbierto((previo) => !previo);
  }

  async function borrar() {
    const ok = await confirmar(
      `¿Borrar esta actualización del ${fmtFecha(actualizacion.fecha)}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      const r = await api.del(`/actualizaciones-uocra/${actualizacion.id}`);
      if (r.advertencia) notificar(r.advertencia, 'warning');
      recargar();
    } catch (err) {
      notificar('No se pudo borrar: ' + err.message);
    }
  }

  return (
    <>
      <Tr>
        <Td label="Fecha">{fmtFecha(actualizacion.fecha)}</Td>
        <Td label="Tipo">{fmtTipoActualizacion(actualizacion.tipo)}</Td>
        <Td label="Motivo">{actualizacion.motivo || ''}</Td>
        <Td label="%" num>
          {fmtPct(actualizacion.porcentaje)}
        </Td>
        <Td label="Ajuste total" num>
          +{fmtMoney(actualizacion.total_ajuste)}
        </Td>
        <Td label="Acciones" className="text-right">
          <div className="flex justify-end gap-2">
            <Button chico onClick={alternarDetalle}>
              Ver
            </Button>
            <Button chico variante="danger" onClick={borrar}>
              Borrar
            </Button>
          </div>
        </Td>
      </Tr>
      {abierto && detalle && (
        <tr className="max-sm:block">
          <td colSpan={6} className="border-b border-gridline px-3 py-1 max-sm:block max-sm:px-0">
            <DetalleActualizacion efectos={detalle.efectos} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function UocraHistorialPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { datos, error, cargando, recargar } = useCargar(
    () =>
      Promise.all([api.get(`/proyectos/${id}`), api.get(`/proyectos/${id}/actualizaciones-uocra`)]).then(
        ([proyecto, lista]) => ({ proyecto, lista })
      ),
    [id]
  );

  const proyecto = datos?.proyecto;
  const lista = datos?.lista ?? [];
  useTitulo(proyecto ? `Actualizaciones — ${proyecto.nombre}` : 'Actualizaciones — Sistema de Obras');

  return (
    <>
      <TopBar>
        <Crumb to="/">Proyectos</Crumb> / <Crumb to={`/proyecto/${id}`}>{proyecto ? proyecto.nombre : '…'}</Crumb> /
        Actualizaciones
      </TopBar>
      <ProyectoTabs proyectoId={id} />

      <Container>
        <Toolbar>
          <H1 className="mb-0">Actualizaciones</H1>
          <div className="flex gap-2">
            {proyecto && <MenuExportar proyectoId={id} proyecto={proyecto} />}
            <Button variante="primary" onClick={() => navigate(`/proyecto/${id}/uocra/nueva`)}>
              + Actualización
            </Button>
          </div>
        </Toolbar>

        <ErrorAlert error={error} />

        <Card className="relative">
          <LoadingOverlay activo={cargando} />
          <Table cards>
            <THead>
              <tr>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Motivo</Th>
                <Th num>%</Th>
                <Th num>Ajuste total</Th>
                <Th className="w-[90px]" />
              </tr>
            </THead>
            <TBody>
              {lista.map((actualizacion) => (
                <FilaActualizacion key={actualizacion.id} actualizacion={actualizacion} recargar={recargar} />
              ))}
            </TBody>
          </Table>

          {!lista.length && <Empty>Todavía no hay actualizaciones cargadas.</Empty>}
        </Card>
      </Container>
    </>
  );
}
