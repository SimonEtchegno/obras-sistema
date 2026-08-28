// Habla con el backend real (Express + Postgres) montado en /api. La forma
// de esta API (get/post/put/patch/del devolviendo promesas, tirando Error
// con .message en caso de falla) se mantiene igual a como estaba con el
// localStorage, así que las pantallas no necesitan cambios.
async function req(method, path, body) {
  const opciones = { method, headers: {} };
  if (body !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(body);
  }
  const respuesta = await fetch(`/api${path}`, opciones);
  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error ${respuesta.status} al conectar con el servidor.`);
  }
  return datos;
}

export const api = {
  async get(path) {
    return req('GET', path);
  },
  async post(path, body) {
    return req('POST', path, body ?? {});
  },
  async put(path, body) {
    return req('PUT', path, body ?? {});
  },
  async patch(path, body) {
    return req('PATCH', path, body || {});
  },
  async del(path) {
    return req('DELETE', path);
  },
};

export default api;
