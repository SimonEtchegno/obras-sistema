export function fmtMoney(n) {
  const v = Number(n) || 0;
  return '$' + Math.round(v).toLocaleString('es-AR');
}

export function fmtPct(n) {
  return (Number(n) || 0).toFixed(1) + '%';
}

export function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Fecha de hoy en formato yyyy-mm-dd (hora local, no UTC) para los <input type="date">.
export function hoyIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Aplana el árbol a sus ítems finales, con la ruta completa como nombre —
// es lo que se certifica y lo que se actualiza por UOCRA.
export function flattenHojas(raices, ruta = []) {
  const out = [];
  for (const nodo of raices) {
    const rutaActual = ruta.concat([nodo.nombre]);
    if (nodo.esHoja) {
      out.push({ ...nodo, ruta: rutaActual.join(' › ') });
    } else {
      out.push(...flattenHojas(nodo.hijos, rutaActual));
    }
  }
  return out;
}
