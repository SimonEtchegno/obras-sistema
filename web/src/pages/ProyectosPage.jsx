import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtFecha, fmtMoney } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, H1, Subtitle, Toolbar, TopBar } from '../components/Layout.jsx';
import { confirmar, notificar } from '../components/Dialogos.jsx';
import {
  Button, Card, Empty, ErrorAlert, Field, FieldRow, InputMonto, LoadingOverlay, Meter, Table, TBody, Td, Th, THead, Tr,
} from '../components/ui/index.js';

function FormNuevoProyecto({ onCancelar, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    setError(null);
    const montoNum = parseFloat(monto);
    if (!nombre.trim() || !fecha || !montoNum) {
      setError(new Error('Completá nombre, fecha y monto.'));
      return;
    }
    setGuardando(true);
    try {
      const proyecto = await api.post('/proyectos', {
        nombre: nombre.trim(),
        fecha_presupuesto_original: fecha,
        monto_presupuesto_original: montoNum,
        descripcion: descripcion.trim(),
      });
      onCreado(proyecto);
    } catch (err) {
      setError(err);
      setGuardando(false);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="mb-4 flex items-center gap-[9px] text-[17px] font-semibold tracking-[-0.01em]">
        <span className="h-[9px] w-[9px] shrink-0 rounded-[3px] bg-accent" />
        Nuevo proyecto
      </h2>

      <FieldRow>
        <Field
          className="min-w-[170px] flex-1"
          label="Nombre de la obra"
          type="text"
          placeholder="Ej: ALEM"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Field
          className="min-w-[170px] flex-1"
          label="Fecha del presupuesto original"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Field className="min-w-[170px] flex-1" label="Monto del presupuesto original ($)">
          {(id) => (
            <InputMonto id={id} className="w-full" placeholder="Ej: 53.000.000" value={monto} onChange={setMonto} />
          )}
        </Field>
      </FieldRow>

      <Field
        label="Descripción (opcional)"
        type="text"
        placeholder="Notas sobre la obra"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <ErrorAlert error={error} />

      <div className="flex flex-wrap gap-2">
        <Button variante="primary" onClick={crear} cargando={guardando}>
          Crear proyecto
        </Button>
        <Button onClick={onCancelar}>Cancelar</Button>
      </div>
    </Card>
  );
}

export default function ProyectosPage() {
  useTitulo('Sistema de Obras');
  const navigate = useNavigate();
  const { datos: proyectos, error, cargando, recargar } = useCargar(() => api.get('/proyectos'), []);
  const [formAbierto, setFormAbierto] = useState(false);

  const lista = proyectos || [];

  return (
    <>
      <TopBar />
      <Container>
        <Toolbar>
          <div>
            <H1>Proyectos</H1>
            <Subtitle className="mb-0">Presupuestos, certificaciones y actualizaciones por obra.</Subtitle>
          </div>
          <Button variante="primary" onClick={() => setFormAbierto(true)}>
            + Nuevo proyecto
          </Button>
        </Toolbar>

        {formAbierto && (
          <FormNuevoProyecto
            onCancelar={() => setFormAbierto(false)}
            onCreado={(proyecto) => navigate(`/proyecto/${proyecto.id}`)}
          />
        )}

        <ErrorAlert error={error} />

        <Card className="relative">
          <LoadingOverlay activo={cargando} />
          <Table cards>
            <THead>
              <tr>
                <Th>Obra</Th>
                <Th>Presupuesto original</Th>
                <Th num>Monto vigente</Th>
                <Th num>Certificado</Th>
                <Th num>Saldo pendiente</Th>
                <Th className="w-40">Avance</Th>
                <Th className="w-24 text-right">Acciones</Th>
              </tr>
            </THead>
            <TBody>
              {lista.map((p) => (
                <Tr
                  key={p.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // El nombre ya es un link; en el resto de la fila navegamos igual si no se clickea un botón.
                    if (e.target.tagName !== 'A' && !e.target.closest('button')) navigate(`/proyecto/${p.id}`);
                  }}
                >
                  <Td label="Obra">
                    <Link to={`/proyecto/${p.id}`} className="text-accent hover:underline">
                      {p.nombre}
                    </Link>
                  </Td>
                  <Td label="Presupuesto original">
                    {fmtMoney(p.monto_presupuesto_original)}{' '}
                    <span className="text-ink-muted">({fmtFecha(p.fecha_presupuesto_original)})</span>
                  </Td>
                  <Td label="Monto vigente" num>
                    {fmtMoney(p.resumen.monto_vigente)}
                  </Td>
                  <Td label="Certificado" num>
                    {fmtMoney(p.resumen.certificado_acumulado)}
                  </Td>
                  <Td label="Saldo pendiente" num>
                    {fmtMoney(p.resumen.saldo_pendiente)}
                  </Td>
                  <Td label="Avance">
                    <Meter pct={p.resumen.porcentaje_avance} className="max-sm:max-w-[180px] max-sm:flex-1" />
                  </Td>
                  <Td label="Acciones" className="text-right">
                    <Button
                      chico
                      variante="danger"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirmar(
                          `¿Eliminar el proyecto "${p.nombre}"?\nSe borrarán todos sus datos (ítems, certificaciones y actualizaciones). Esta acción no se puede deshacer.`
                        );
                        if (!ok) return;
                        try {
                          await api.del(`/proyectos/${p.id}`);
                          recargar();
                        } catch (err) {
                          notificar('No se pudo eliminar el proyecto: ' + err.message);
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          {!lista.length && <Empty>Todavía no hay proyectos. Creá el primero arriba.</Empty>}
        </Card>
      </Container>
    </>
  );
}
