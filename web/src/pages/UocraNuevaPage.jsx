import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtMoney, fmtPct, fmtTipoActualizacion, hoyIso } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Section, SectionTitle, Subtitle, TopBar } from '../components/Layout.jsx';
import {
  Button, Card, Empty, ErrorAlert, Field, FieldRow, InputMonto, Label, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';
import { confirmar } from '../components/Dialogos.jsx';

const SIN_VALOR = {
  porcentaje: 'Completá el % de aumento para ver el efecto calculado.',
  monto: 'Completá el monto de aumento para ver cómo se reparte.',
};

export default function UocraNuevaPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { datos, error: errorCarga } = useCargar(() => api.get(`/proyectos/${id}`), [id]);

  const proyecto = datos;
  useTitulo(proyecto ? `Nueva actualización — ${proyecto.nombre}` : 'Nueva actualización — Sistema de Obras');

  const [fecha, setFecha] = useState(hoyIso());
  const [tipo, setTipo] = useState('uocra');
  const [modo, setModo] = useState('porcentaje');
  const [porcentaje, setPorcentaje] = useState('');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [preview, setPreview] = useState({ filas: [], mensaje: SIN_VALOR.porcentaje });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Lo que se manda al servidor según cómo se esté cargando el aumento. Si el
  // campo del modo elegido está vacío, no hay nada que previsualizar todavía.
  const valor = modo === 'monto' ? parseFloat(monto) : parseFloat(porcentaje);
  const cuerpo = modo === 'monto' ? { modo, monto: valor } : { modo, porcentaje: valor };

  // La vista previa se recalcula sola con cada cambio: el ajuste se aplica
  // sobre el saldo pendiente de todo el proyecto, así que conviene verlo
  // antes de confirmar.
  useEffect(() => {
    let vigente = true;

    if (isNaN(valor)) {
      setPreview({ filas: [], mensaje: SIN_VALOR[modo] });
      return;
    }

    api
      .post(`/proyectos/${id}/actualizaciones-uocra/preview`, cuerpo)
      .then((filas) => {
        if (vigente) setPreview({ filas, mensaje: filas.length ? null : SIN_VALOR[modo] });
      })
      .catch((err) => {
        if (vigente) setPreview({ filas: [], mensaje: err.message });
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modo, valor]);

  // Totales de la vista previa: sirven para mostrar la equivalencia entre las
  // dos formas de cargarlo (un monto siempre representa algún % del saldo, y
  // al revés), así se ve el otro número sin tener que calcularlo a mano.
  const totalAjuste = preview.filas.reduce((acc, f) => acc + f.monto_ajuste, 0);
  const saldoTotal = preview.filas.reduce((acc, f) => acc + f.saldo_pendiente_antes, 0);
  const pctEfectivo = saldoTotal > 0 ? (totalAjuste / saldoTotal) * 100 : 0;

  async function guardar() {
    setError(null);

    if (!fecha || isNaN(valor)) {
      setError(new Error(modo === 'monto' ? 'Completá fecha y monto de aumento.' : 'Completá fecha y % de aumento.'));
      return;
    }
    const resumenAumento =
      modo === 'monto' ? `${fmtMoney(valor)} (${fmtPct(pctEfectivo)})` : `${valor}% (${fmtMoney(totalAjuste)})`;
    const ok = await confirmar(
      `¿Confirmás aplicar un aumento de ${resumenAumento} por ${fmtTipoActualizacion(tipo)} a todo el proyecto? Esta actualización queda registrada en el historial.`,
      { textoConfirmar: 'Confirmar', variante: 'primary' }
    );
    if (!ok) return;

    setGuardando(true);
    try {
      await api.post(`/proyectos/${id}/actualizaciones-uocra`, {
        fecha,
        tipo,
        ...cuerpo,
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
        Nueva actualización
      </TopBar>

      <Container>
        <H1>Nueva actualización</H1>
        <Subtitle>
          El aumento se puede cargar como porcentaje o como monto total, y afecta a todos los ítems del proyecto
          sobre su saldo pendiente (lo no certificado). Lo ya certificado no se modifica.
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
              {modo === 'monto' ? (
                <Field className="min-w-[170px] flex-1" label="Monto de aumento">
                  {(idCampo) => (
                    <InputMonto id={idCampo} className="w-full" value={monto} onChange={setMonto} />
                  )}
                </Field>
              ) : (
                <Field
                  className="min-w-[170px] flex-1"
                  label="% de aumento"
                  type="number"
                  step="0.01"
                  placeholder="Ej: 8.5"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                />
              )}
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
              <Label>Cómo se carga el aumento</Label>
              <label className="mr-4 inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="modo"
                  value="porcentaje"
                  checked={modo === 'porcentaje'}
                  onChange={() => setModo('porcentaje')}
                />{' '}
                Por porcentaje
              </label>
              <label className="inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="modo"
                  value="monto"
                  checked={modo === 'monto'}
                  onChange={() => setModo('monto')}
                />{' '}
                Por monto
              </label>
            </div>

            <div>
              <Label>Tipo de actualización</Label>
              <label className="mr-4 inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="tipo"
                  value="uocra"
                  checked={tipo === 'uocra'}
                  onChange={() => setTipo('uocra')}
                />{' '}
                UOCRA
              </label>
              <label className="inline-flex items-center gap-1.5 text-ink">
                <input
                  type="radio"
                  name="tipo"
                  value="indice_construccion"
                  checked={tipo === 'indice_construccion'}
                  onChange={() => setTipo('indice_construccion')}
                />{' '}
                Índice de la construcción
              </label>
            </div>
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

            {!!preview.filas.length && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-gridline pt-3">
                <span className="text-[13px] text-ink-muted">
                  {modo === 'monto'
                    ? 'Repartido entre los ítems según su saldo pendiente.'
                    : 'Aplicado sobre el saldo pendiente de cada ítem.'}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                    Equivale a
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">{fmtPct(pctEfectivo)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                    Ajuste total
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">+{fmtMoney(totalAjuste)}</span>
                </span>
              </div>
            )}
          </Card>
        </Section>

        <ErrorAlert error={error} />

        <div className="flex flex-wrap gap-2">
          <Button variante="primary" onClick={guardar} cargando={guardando}>
            Confirmar y guardar actualización
          </Button>
          <Button onClick={() => navigate(`/proyecto/${id}/uocra`)}>Cancelar</Button>
        </div>
      </Container>
    </>
  );
}
