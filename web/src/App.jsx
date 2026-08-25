import { Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { Container, TopBar } from './components/Layout.jsx';
import { Empty } from './components/ui/index.js';
import ProyectosPage from './pages/ProyectosPage.jsx';
import ProyectoPage from './pages/ProyectoPage.jsx';
import CertificacionesPage from './pages/CertificacionesPage.jsx';
import UocraHistorialPage from './pages/UocraHistorialPage.jsx';
import UocraNuevaPage from './pages/UocraNuevaPage.jsx';

// Las páginas viejas se enlazaban entre sí con ?id= / ?proyecto=. Los links y
// favoritos que quedaron por ahí siguen funcionando: se traducen a la ruta
// nueva y se reemplaza la entrada en el historial.
function RedireccionVieja({ param, ruta }) {
  const [params] = useSearchParams();
  const id = params.get(param);
  return <Navigate to={id ? ruta(id) : '/'} replace />;
}

function NoEncontrada() {
  return (
    <>
      <TopBar />
      <Container>
        <Empty>
          No encontramos esa página.{' '}
          <Link to="/" className="text-accent hover:underline">
            Volver a proyectos
          </Link>
          .
        </Empty>
      </Container>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProyectosPage />} />
      <Route path="/proyecto/:id" element={<ProyectoPage />} />
      <Route path="/proyecto/:id/certificaciones" element={<CertificacionesPage />} />
      <Route path="/proyecto/:id/uocra" element={<UocraHistorialPage />} />
      <Route path="/proyecto/:id/uocra/nueva" element={<UocraNuevaPage />} />

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="/proyecto.html" element={<RedireccionVieja param="id" ruta={(id) => `/proyecto/${id}`} />} />
      <Route
        path="/certificaciones.html"
        element={<RedireccionVieja param="proyecto" ruta={(id) => `/proyecto/${id}/certificaciones`} />}
      />
      <Route
        path="/certificacion-nueva.html"
        element={<RedireccionVieja param="proyecto" ruta={(id) => `/proyecto/${id}/certificaciones`} />}
      />
      <Route
        path="/uocra-historial.html"
        element={<RedireccionVieja param="proyecto" ruta={(id) => `/proyecto/${id}/uocra`} />}
      />
      <Route
        path="/uocra-nueva.html"
        element={<RedireccionVieja param="proyecto" ruta={(id) => `/proyecto/${id}/uocra/nueva`} />}
      />

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
