import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos del api y devuelve { datos, cargando, error, recargar }.
// `recargar` es lo que reemplaza al cargarTodo() de las páginas viejas: se
// llama después de guardar algo y la pantalla se vuelve a pintar con los
// montos recalculados. Mientras recarga se mantienen los datos anteriores en
// pantalla para que no parpadee.
export function useCargar(cargar, deps = []) {
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    Promise.resolve()
      .then(() => cargarRef.current())
      .then((datos) => {
        if (vigente) setEstado({ cargando: false, error: null, datos });
      })
      .catch((error) => {
        if (vigente) setEstado((previo) => ({ cargando: false, error, datos: previo.datos }));
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { ...estado, recargar };
}

export default useCargar;
