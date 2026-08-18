import LocalDB from './localStore.js';

// Todo se guarda en el navegador (localStorage) por ahora — ver localStore.js.
// La forma de esta API (get/post/put/patch/del devolviendo promesas, tirando
// Error con .message en caso de falla) se mantiene igual para no tener que
// tocar las pantallas cuando esto pase a ser un backend real.
export const api = {
  async get(path) {
    return LocalDB.dispatch('GET', path);
  },
  async post(path, body) {
    return LocalDB.dispatch('POST', path, body);
  },
  async put(path, body) {
    return LocalDB.dispatch('PUT', path, body);
  },
  async patch(path, body) {
    return LocalDB.dispatch('PATCH', path, body || {});
  },
  async del(path) {
    return LocalDB.dispatch('DELETE', path);
  },
};

export default api;
