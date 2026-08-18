import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { flattenHojas, fmtMoney, hoyIso } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Section, SectionTitle, Subtitle, TopBar } from '../components/Layout.jsx';
import {
  Button, Card, Empty, ErrorAlert, Field, FieldRow, Label, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';

const SIN_PORCENTAJE = 'Completá el % de aumento para ver el efecto calculado.';

export default function UocraNuevaPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { datos, error: errorCarga } = useCargar(
    () =>
      Promise.all([api.get(`/proyectos/${id}`), api.get(`/proyectos/${id}/items`)]).then(([proyecto, arbol]) => ({
        proyecto,
        hojas: flattenHojas(arbol),
      })),
    [id]
  );

  const proyecto = datos?.proyecto;
  const hojas = datos?.hojas ?? [];
  useTitulo(proyecto ? `Nueva actualización UOCRA — ${proyecto.nombre}` : 'Nueva actualización UOCRA — Sistema de Obras');

  const [fecha, setFecha] = useState(hoyIso());
  const [porcentaje, setPorcentaje] = useState('');
  const [motivo, setMotivo] = useState('');
  const [alcance, setAlcance] = useState('todos');
  const [seleccionados, setSeleccionados] = useState([]);
  const [preview, setPreview] = useState({ filas: [], mensaje: SIN_PORCENTAJE });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const itemIds = alcance === 'seleccion' ? seleccionados : undefined;

  // La vista previa se recalcula sola con cada cambio: el ajuste se aplica
  // sobre el saldo pendiente, así que conviene verlo antes de confirmar.
  useEffect(() => {
    let vigente = true;
    const pct = parseFloat(porcentaje);

    if (isNaN(pct)) {
      setPreview({ filas: [], mensaje: SIN_PORCENTAJE });
      return;
    }
    if (alcance === 'seleccion' && !seleccionados.length) {
      setPreview({ filas: [], mensaje: 'Elegí al menos un ítem.' });
      return;
    }

    api
      .post(`/proyectos/${id}/actualizaciones-uocra/preview`, {
        alcance,
        item_ids: alcance === 'seleccion' ? seleccionados : undefined,
        porcentaje: pct,
      })
      .then((filas) => {
        if (vigente) setPreview({ filas, mensaje: filas.length ? null : SIN_PORCENTAJE });
      })
      .catch((err) => {
        if (vigente) setPreview({ filas: [], mensaje: err.message });
      });

    return () => {
      vigente = false;
    };
  }, [id, porcentaje, alcance, seleccionados]);

  function alternarItem(itemId) {
    setSeleccionados((previos) =>
      previos.includes(itemId) ? previos.filter((x) => x !== itemId) : [...previos, itemId]
    );
  }

  async function guardar() {
    setError(null);
    const pct = parseFloat(porcentaje);

    if (!fecha || isNaN(pct)) {
      setError(new Error('Completá fecha y % de aumento.'));
      return;
    }
    if (alcance === 'seleccion' && !seleccionados.length) {
      setError(new Error('Elegí al menos un ítem, o cambiá el alcance a "Todo el proyecto".'));
      return;
    }
    if (!confirm(`¿Confirmás aplicar ${pct}% de aumento? Esta actualización queda registrada en el historial.`)) return;

    setGuardando(true);
    try {
      await api.post(`/proyectos/${id}/actualizaciones-uocra`, {
        fecha,
        porcentaje: pct,
        alcance,
        item_ids: itemIds,
        motivo: motivo.trim(),
      });
      navigate(`/proyecto/${id}/uocra`);
    } catch (err) {
      setError(err);
      setGuardando(false);
    }
  }

  return (
    <>
      <TopBar>
        <Crumb to="/">Proyectos</Crumb> / <Crumb to={`/proyecto/${id}`}>{proyecto ? proyecto.nombre : '…'}</Crumb> /
        Nueva actualización UOCRA
      </TopBar>

      <Container>
        <H1>Nueva actualización UOCRA</H1>
        <Subtitle>
          El % de aumento se aplica sobre el saldo pendiente (lo no certificado) de cada ítem afectado. Lo ya
          certificado no se modifica.
        </Subtitle>

        <ErrorAlert error={errorCarga} />

        <Section>
          <Card>
            <FieldRow>
              <Field
                className="min-w-[170px] flex-1"
                label="Fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <Field
                className="min-w-[170px] flex-1"
                label="% de aumento"
                type="number"
                step="0.01"
                placeholder="Ej: 8.5"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
              <Field
                className="min-w-[170px] flex-[2]"
                label="Motivo (opcional)"
                type="text"
                placeholder="Ej: Acuerdo UOCRA agosto 2026"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </FieldRow>

            <div className="mb-4">
              <Label>Alcance</Label>
              <label className="mr-4 inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="alcance"
                  value="todos"
                  checked={alcance === 'todos'}
                  onChange={() => setAlcance('todos')}
                />{' '}
                Todo el proyecto
              </label>
              <label className="inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="alcance"
                  value="seleccion"
                  checked={alcance === 'seleccion'}
                  onChange={() => setAlcance('seleccion')}
                />{' '}
                Elegir ítems
              </label>
            </div>

            {alcance === 'seleccion' &&
              (hojas.length ? (
                <div>
                  {hojas.map((hoja) => (
                    <label key={hoja.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(hoja.id)}
                        onChange={() => alternarItem(hoja.id)}
                      />
                      {hoja.ruta} <span className="text-ink-muted">(saldo {fmtMoney(hoja.saldo_pendiente)})</span>
                    </label>
                  ))}
                </div>
              ) : (
                <Empty>Este proyecto no tiene ítems finales todavía.</Empty>
              ))}
          </Card>
        </Section>

        <Section>
          <Card>
            <SectionTitle>Vista previa del ajuste</SectionTitle>
            <Table cards>
              <THead>
                <tr>
                  <Th>Ítem</Th>
                  <Th num>Saldo pendiente antes</Th>
                  <Th num>Ajuste</Th>
                  <Th num>Vigente después</Th>
                </tr>
              </THead>
              <TBody>
                {preview.filas.map((fila) => (
                  <Tr key={fila.item_id}>
                    <Td label="Ítem">{fila.item_nombre}</Td>
                    <Td label="Saldo pendiente antes" num>
                      {fmtMoney(fila.saldo_pendiente_antes)}
                    </Td>
                    <Td label="Ajuste" num>
                      +{fmtMoney(fila.monto_ajuste)}
                    </Td>
                    <Td label="Vigente después" num>
                      {fmtMoney(fila.monto_vigente_despues)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            {preview.mensaje && <Empty>{preview.mensaje}</Empty>}
          </Card>
        </Section>

        <ErrorAlert error={error} />

        <div className="flex flex-wrap gap-2">
          <Button variante="primary" onClick={guardar} disabled={guardando}>
            Confirmar y guardar actualización
          </Button>
          <Button onClick={() => navigate(`/proyecto/${id}/uocra`)}>Cancelar</Button>
        </div>
      </Container>
    </>
  );
}
