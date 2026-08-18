import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { flattenHojas, fmtMoney, hoyIso } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Section, SectionTitle, Subtitle, TopBar } from '../components/Layout.jsx';
import {
  Button, Card, Empty, ErrorAlert, Field, FieldRow, Input, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';

export default function CertificacionNuevaPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { datos, error: errorCarga } = useCargar(
    () =>
      Promise.all([
        api.get(`/proyectos/${id}`),
        api.get(`/proyectos/${id}/items`),
        api.get(`/proyectos/${id}/certificaciones`),
      ]).then(([proyecto, arbol, certificaciones]) => ({ proyecto, hojas: flattenHojas(arbol), certificaciones })),
    [id]
  );

  const proyecto = datos?.proyecto;
  const hojas = datos?.hojas ?? [];
  useTitulo(proyecto ? `Nueva certificación — ${proyecto.nombre}` : 'Nueva certificación — Sistema de Obras');

  const [numero, setNumero] = useState(null);
  const [fecha, setFecha] = useState(hoyIso());
  const [descripcion, setDescripcion] = useState('');
  // { [item_id]: { pct: '12.5', monto: '400000' } } — lo que se carga a mano.
  const [valores, setValores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // El número propuesto es el siguiente al último cargado, hasta que se toque.
  const numeroVisible = numero ?? (datos ? String(datos.certificaciones.length + 1) : '');

  // Cargar % o monto completa el otro: son dos vistas del mismo dato.
  function cambiarPct(hoja, pct) {
    const monto =
      pct === '' || hoja.monto_vigente <= 0 ? valores[hoja.id]?.monto ?? '' : String(Math.round(hoja.monto_vigente * (parseFloat(pct) / 100)));
    setValores((previos) => ({ ...previos, [hoja.id]: { pct, monto } }));
  }

  function cambiarMonto(hoja, monto) {
    const pct =
      monto === '' || hoja.monto_vigente <= 0 ? valores[hoja.id]?.pct ?? '' : ((parseFloat(monto) / hoja.monto_vigente) * 100).toFixed(2);
    setValores((previos) => ({ ...previos, [hoja.id]: { pct, monto } }));
  }

  async function guardar() {
    setError(null);
    if (!fecha) {
      setError(new Error('Falta la fecha de la certificación.'));
      return;
    }

    const detalles = [];
    for (const hoja of hojas) {
      const { pct = '', monto = '' } = valores[hoja.id] ?? {};
      if (pct === '' && monto === '') continue;
      detalles.push({
        item_id: hoja.id,
        porcentaje_certificado: pct === '' ? null : parseFloat(pct),
        monto_certificado: monto === '' ? null : parseFloat(monto),
      });
    }

    if (!detalles.length) {
      setError(new Error('Cargá al menos un ítem con % o monto.'));
      return;
    }

    setGuardando(true);
    try {
      const resultado = await api.post(`/proyectos/${id}/certificaciones`, {
        numero: parseInt(numeroVisible, 10) || null,
        fecha,
        descripcion: descripcion.trim(),
        detalles,
      });
      // Los avisos (ítems que pasan del 100%) se muestran en el historial.
      navigate(`/proyecto/${id}/certificaciones`, { state: { avisos: resultado.avisos ?? [] } });
    } catch (err) {
      setError(err);
      setGuardando(false);
    }
  }

  return (
    <>
      <TopBar>
        <Crumb to="/">Proyectos</Crumb> / <Crumb to={`/proyecto/${id}`}>{proyecto ? proyecto.nombre : '…'}</Crumb> /
        Nueva certificación
      </TopBar>

      <Container>
        <H1>Nueva certificación</H1>
        <Subtitle>
          Cargá el avance de este período. Podés ingresar % o monto por ítem — se completa el otro solo. No hace falta
          cargar todos los ítems: los que dejes en blanco no se tocan.
        </Subtitle>

        <ErrorAlert error={errorCarga} />

        <Section>
          <Card>
            <FieldRow>
              <Field
                className="min-w-[170px] flex-1"
                label="Número"
                type="number"
                value={numeroVisible}
                onChange={(e) => setNumero(e.target.value)}
              />
              <Field
                className="min-w-[170px] flex-1"
                label="Fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <Field
                className="min-w-[170px] flex-[2]"
                label="Descripción (opcional)"
                type="text"
                placeholder="Ej: Certificación julio 2025"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </FieldRow>
          </Card>
        </Section>

        <Section>
          <Card>
            <SectionTitle>Ítems</SectionTitle>
            <Table cards>
              <THead>
                <tr>
                  <Th>Ítem</Th>
                  <Th num>Monto vigente</Th>
                  <Th num>Saldo pendiente</Th>
                  <Th num className="w-[110px]">
                    % este período
                  </Th>
                  <Th num className="w-40">
                    Monto este período
                  </Th>
                </tr>
              </THead>
              <TBody>
                {hojas.map((hoja) => (
                  <Tr key={hoja.id}>
                    <Td label="Ítem">{hoja.ruta}</Td>
                    <Td label="Monto vigente" num>
                      {fmtMoney(hoja.monto_vigente)}
                    </Td>
                    <Td label="Saldo pendiente" num>
                      {fmtMoney(hoja.saldo_pendiente)}
                    </Td>
                    <Td label="% este período" num>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-20 text-right"
                        value={valores[hoja.id]?.pct ?? ''}
                        onChange={(e) => cambiarPct(hoja, e.target.value)}
                      />
                    </Td>
                    <Td label="Monto este período" num>
                      <Input
                        type="number"
                        step="1"
                        className="w-[140px] text-right"
                        value={valores[hoja.id]?.monto ?? ''}
                        onChange={(e) => cambiarMonto(hoja, e.target.value)}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            {!hojas.length && (
              <Empty>
                Este proyecto no tiene ítems finales todavía. Agregalos desde la página del proyecto.
              </Empty>
            )}
          </Card>
        </Section>

        <ErrorAlert error={error} />

        <div className="flex flex-wrap gap-2">
          <Button variante="primary" onClick={guardar} disabled={guardando}>
            Guardar certificación
          </Button>
          <Button onClick={() => navigate(`/proyecto/${id}/certificaciones`)}>Cancelar</Button>
        </div>
      </Container>
    </>
  );
}
