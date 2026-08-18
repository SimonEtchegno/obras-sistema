import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtFecha, fmtMoney, fmtPct } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Toolbar, TopBar } from '../components/Layout.jsx';
import ProyectoTabs from '../components/ProyectoTabs.jsx';
import {
  Alert, Button, Card, Empty, ErrorAlert, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';

function DetalleCertificacion({ detalles }) {
  return (
    <Table className="my-1.5">
      <THead>
        <tr>
          <Th>Ítem</Th>
          <Th num>Monto vigente (al certificar)</Th>
          <Th num>% certificado</Th>
          <Th num>Monto certificado</Th>
        </tr>
      </THead>
      <TBody>
        {detalles.map((d) => (
          <Tr key={d.id}>
            <Td>{d.item_nombre}</Td>
            <Td num>{fmtMoney(d.monto_vigente_snapshot)}</Td>
            <Td num>{d.porcentaje_certificado != null ? fmtPct(d.porcentaje_certificado) : '—'}</Td>
            <Td num>{fmtMoney(d.monto_certificado)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function FilaCertificacion({ cert, recargar }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null);

  async function alternarDetalle() {
    if (!abierto && !detalle) {
      setDetalle(await api.get(`/certificaciones/${cert.id}`));
    }
    setAbierto((previo) => !previo);
  }

  async function borrar() {
    if (!confirm(`¿Borrar la certificación N° ${cert.numero ?? cert.id}? Esta acción no se puede deshacer.`)) return;
    await api.del(`/certificaciones/${cert.id}`);
    recargar();
  }

  return (
    <>
      <Tr>
        <Td label="N°">{cert.numero ?? ''}</Td>
        <Td label="Fecha">{fmtFecha(cert.fecha)}</Td>
        <Td label="Descripción">{cert.descripcion || ''}</Td>
        <Td label="Total certificado" num>
          {fmtMoney(cert.total_certificado)}
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
          <td colSpan={5} className="border-b border-gridline px-3 py-1 max-sm:block max-sm:px-0">
            <DetalleCertificacion detalles={detalle.detalles} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function CertificacionesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Los avisos de sobre-certificación llegan desde la pantalla de carga.
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
        <Toolbar>
          <H1 className="mb-0">Certificaciones</H1>
          <Button variante="primary" onClick={() => navigate(`/proyecto/${id}/certificaciones/nueva`)}>
            + Nueva certificación
          </Button>
        </Toolbar>

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
                <Th className="w-[70px]">N°</Th>
                <Th>Fecha</Th>
                <Th>Descripción</Th>
                <Th num>Total certificado</Th>
                <Th className="w-[90px]" />
              </tr>
            </THead>
            <TBody>
              {lista.map((cert) => (
                <FilaCertificacion key={cert.id} cert={cert} recargar={recargar} />
              ))}
            </TBody>
          </Table>

          {!lista.length && <Empty>Todavía no hay certificaciones cargadas.</Empty>}
        </Card>
      </Container>
    </>
  );
}
