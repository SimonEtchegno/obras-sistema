// Todo se guarda en el navegador (localStorage) por ahora — ver local-store.js.
// La forma de esta API (get/post/put/patch/del devolviendo promesas, tirando
// Error con .message en caso de falla) se mantiene igual para no tener que
// tocar el resto de las páginas cuando esto pase a ser un backend real.
const api = {
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

function fmtMoney(n) {
  const v = Number(n) || 0;
  return '$' + Math.round(v).toLocaleString('es-AR');
}

function fmtPct(n) {
  return (Number(n) || 0).toFixed(1) + '%';
}

function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function meterHtml(pct, ancho) {
  const pctNum = Number(pct) || 0;
  const clamped = Math.max(0, Math.min(100, pctNum));
  const over = pctNum > 100;
  return `
    <div class="meter" style="${ancho ? `width:${ancho}px` : ''}" title="${fmtPct(pctNum)} certificado">
      <div class="track"><div class="fill ${over ? 'over' : ''}" style="width:${clamped}%"></div></div>
      <div class="pct">${fmtPct(pctNum)}</div>
    </div>`;
}

function mostrarError(contenedor, err) {
  contenedor.innerHTML = `<div class="alert error">${err.message || err}</div>`;
}

function flattenHojas(raices, ruta) {
  ruta = ruta || [];
  const out = [];
  for (const nodo of raices) {
    const rutaActual = ruta.concat([nodo.nombre]);
    if (nodo.esHoja) {
      out.push(Object.assign({}, nodo, { ruta: rutaActual.join(' › ') }));
    } else {
      out.push(...flattenHojas(nodo.hijos, rutaActual));
    }
  }
  return out;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
