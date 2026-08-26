import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { fmtFecha, fmtMoney } from '../lib/format.js';
import useCargar from '../hooks/useCargar.js';
import useTitulo from '../hooks/useTitulo.js';
import { Container, Crumb, H1, Section, SectionTitle, Subtitle, Toolbar, TopBar } from '../components/Layout.jsx';
import ProyectoTabs from '../components/ProyectoTabs.jsx';
import MenuExportar from '../components/MenuExportar.jsx';
import PieComposicion from '../components/PieComposicion.jsx';
import ArbolItems from '../components/ArbolItems.jsx';
import Extras from '../components/Extras.jsx';
import { IconoCheck, IconoDocumento, IconoReloj, IconoTendencia } from '../components/Icons.jsx';
import { Button, Card, Empty, ErrorAlert, KpiRow, KpiTile, Meter } from '../components/ui/index.js';

export default function ProyectoPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { datos, error, cargando, recargar } = useCargar(
    () =>
      Promise.all([
        api.get(`/proyectos/${id}`),
        api.get(`/proyectos/${id}/items`),
        api.get(`/proyectos/${id}/certificaciones`),
      ]).then(([proyecto, arbol, certificaciones]) => ({ proyecto, arbol, certificaciones })),
    [id]
  );

  const proyecto = datos?.proyecto;
  const arbol = datos?.arbol ?? [];
  const certificaciones = datos?.certificaciones ?? [];
  useTitulo(proyecto ? `${proyecto.nombre} — Sistema de Obras` : 'Proyecto — Sistema de Obras');

  if (!proyecto) {
    return (
      <>
        <TopBar>
          <Crumb to="/">Proyectos</Crumb> / …
        </TopBar>
        <Container>
          <ErrorAlert error={error} />
          {cargando && <Empty>Cargando…</Empty>}
        </Container>
      </>
    );
  }

  const resumen = proyecto.resumen;

  return (
    <>
      <TopBar>
        <Crumb to="/">Proyectos</Crumb> / {proyecto.nombre}
      </TopBar>
      <ProyectoTabs proyectoId={id} />

      <Container>
        <Toolbar>
          <div>
            <H1>{proyecto.nombre}</H1>
            <Subtitle className="mb-0">
              Presupuesto original: {fmtMoney(proyecto.monto_presupuesto_original)} al{' '}
              {fmtFecha(proyecto.fecha_presupuesto_original)}
            </Subtitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <MenuExportar proyectoId={id} proyecto={proyecto} />
            <Button onClick={() => navigate(`/proyecto/${id}/uocra/nueva`)}>+ Actualización</Button>
          </div>
        </Toolbar>

        <ErrorAlert error={error} />

        <Section>
          <KpiRow>
            <KpiTile
              icono={<IconoDocumento />}
              label="Presupuesto original"
              valor={fmtMoney(proyecto.monto_presupuesto_original)}
            />
            <KpiTile icono={<IconoTendencia />} label="Monto vigente" valor={fmtMoney(resumen.monto_vigente)} acento />
            <KpiTile
              icono={<IconoCheck />}
              label="Certificado acumulado"
              valor={fmtMoney(resumen.certificado_acumulado)}
            />
            <KpiTile icono={<IconoReloj />} label="Saldo pendiente" valor={fmtMoney(resumen.saldo_pendiente)} />
          </KpiRow>
        </Section>

        <Section>
          <Card>
            <SectionTitle>Composición del presupuesto</SectionTitle>
            <PieComposicion raices={arbol} resumen={resumen} />
          </Card>
        </Section>

        <Section>
          <Card>
            <SectionTitle>Avance general</SectionTitle>
            <Meter pct={resumen.porcentaje_avance} />
            <p className="mt-2.5 text-ink-muted">
              Certificado {fmtMoney(resumen.certificado_acumulado)} sobre {fmtMoney(resumen.monto_vigente)} vigentes.
            </p>
          </Card>
        </Section>

        <Section>
          <Card>
            <SectionTitle>Ítems del presupuesto</SectionTitle>
            <Subtitle>
              Los ítems con subdivisiones son organizativos: su monto y avance son la suma de sus hijos. Solo se
              certifica y se actualiza (por UOCRA o índice de la construcción) sobre ítems finales (sin
              subdivisiones).
            </Subtitle>

            <ArbolItems raices={arbol} proyectoId={id} certificaciones={certificaciones} recargar={recargar} />
          </Card>
        </Section>

        <Section>
          <Extras proyectoId={id} />
        </Section>
      </Container>
    </>
  );
}
