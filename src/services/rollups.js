const db = require('../db');

function getAjustesUocraPorItem(proyectoId) {
  const filas = db.prepare(`
    SELECT e.item_id, SUM(e.monto_ajuste) as total
    FROM actualizacion_uocra_efecto e
    JOIN actualizacion_uocra a ON a.id = e.actualizacion_id
    WHERE a.proyecto_id = ?
    GROUP BY e.item_id
  `).all(proyectoId);
  const mapa = new Map();
  for (const f of filas) mapa.set(f.item_id, f.total);
  return mapa;
}

function getCertificadoPorItem(proyectoId) {
  const filas = db.prepare(`
    SELECT d.item_id, SUM(d.monto_certificado) as total
    FROM certificacion_detalle d
    JOIN certificacion c ON c.id = d.certificacion_id
    WHERE c.proyecto_id = ?
    GROUP BY d.item_id
  `).all(proyectoId);
  const mapa = new Map();
  for (const f of filas) mapa.set(f.item_id, f.total);
  return mapa;
}

// Árbol de ítems con montos calculados. Las hojas (ítems sin subdivisiones)
// llevan su propio monto_base + ajustes UOCRA y su certificado acumulado.
// Los ítems padre son puramente organizativos: sus totales son la suma de
// sus hijos, para no contar dos veces el mismo presupuesto.
function getArbolConRollups(proyectoId) {
  const items = db.prepare(
    'SELECT * FROM item WHERE proyecto_id = ? AND activo = 1 ORDER BY parent_id, orden, id'
  ).all(proyectoId);

  const ajustes = getAjustesUocraPorItem(proyectoId);
  const certificado = getCertificadoPorItem(proyectoId);

  const porId = new Map();
  for (const it of items) {
    porId.set(it.id, { ...it, hijos: [], esHoja: true });
  }
  const raices = [];
  for (const it of porId.values()) {
    if (it.parent_id && porId.has(it.parent_id)) {
      const padre = porId.get(it.parent_id);
      padre.hijos.push(it);
      padre.esHoja = false;
    } else {
      raices.push(it);
    }
  }

  function calcular(nodo) {
    if (nodo.esHoja) {
      nodo.monto_vigente = nodo.monto_base + (ajustes.get(nodo.id) || 0);
      nodo.certificado_acumulado = certificado.get(nodo.id) || 0;
    } else {
      let vigente = 0;
      let cert = 0;
      for (const hijo of nodo.hijos) {
        calcular(hijo);
        vigente += hijo.monto_vigente;
        cert += hijo.certificado_acumulado;
      }
      nodo.monto_vigente = vigente;
      nodo.certificado_acumulado = cert;
    }
    nodo.saldo_pendiente = nodo.monto_vigente - nodo.certificado_acumulado;
    nodo.porcentaje_avance = nodo.monto_vigente > 0
      ? (nodo.certificado_acumulado / nodo.monto_vigente) * 100
      : 0;
    return nodo;
  }

  raices.forEach(calcular);
  return raices;
}

function listarHojas(proyectoId) {
  const raices = getArbolConRollups(proyectoId);
  const hojas = [];
  function recorrer(nodo) {
    if (nodo.esHoja) hojas.push(nodo);
    else nodo.hijos.forEach(recorrer);
  }
  raices.forEach(recorrer);
  return hojas;
}

function buscarItem(proyectoId, itemId) {
  const idNum = Number(itemId);
  let encontrado = null;
  function recorrer(nodo) {
    if (encontrado) return;
    if (nodo.id === idNum) { encontrado = nodo; return; }
    nodo.hijos.forEach(recorrer);
  }
  getArbolConRollups(proyectoId).forEach(recorrer);
  return encontrado;
}

function resumenProyecto(proyectoId) {
  const raices = getArbolConRollups(proyectoId);
  let monto_vigente = 0;
  let certificado_acumulado = 0;
  for (const r of raices) {
    monto_vigente += r.monto_vigente;
    certificado_acumulado += r.certificado_acumulado;
  }
  const saldo_pendiente = monto_vigente - certificado_acumulado;
  const porcentaje_avance = monto_vigente > 0 ? (certificado_acumulado / monto_vigente) * 100 : 0;
  return { monto_vigente, certificado_acumulado, saldo_pendiente, porcentaje_avance };
}

module.exports = { getArbolConRollups, listarHojas, buscarItem, resumenProyecto };
