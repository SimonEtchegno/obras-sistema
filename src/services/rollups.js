const { query } = require('../db');

async function getAjustesUocraPorItem(proyectoId) {
  const { rows } = await query(`
    SELECT e.item_id, SUM(e.monto_ajuste) as total
    FROM actualizacion_uocra_efecto e
    JOIN actualizacion_uocra a ON a.id = e.actualizacion_id
    WHERE a.proyecto_id = $1
    GROUP BY e.item_id
  `, [proyectoId]);
  const mapa = new Map();
  for (const f of rows) mapa.set(f.item_id, Number(f.total));
  return mapa;
}

async function getCertificadoPorItem(proyectoId) {
  const { rows } = await query(`
    SELECT d.item_id, SUM(d.monto_certificado) as total
    FROM certificacion_detalle d
    JOIN certificacion c ON c.id = d.certificacion_id
    WHERE c.proyecto_id = $1
    GROUP BY d.item_id
  `, [proyectoId]);
  const mapa = new Map();
  for (const f of rows) mapa.set(f.item_id, Number(f.total));
  return mapa;
}

// Árbol de ítems con montos calculados. Las hojas (ítems sin subdivisiones)
// llevan su propio monto_base + ajustes UOCRA y su certificado acumulado.
// Los ítems padre son puramente organizativos: sus totales son la suma de
// sus hijos, para no contar dos veces el mismo presupuesto.
async function getArbolConRollups(proyectoId) {
  const { rows: items } = await query(
    'SELECT * FROM item WHERE proyecto_id = $1 AND activo = 1 ORDER BY parent_id, orden, id',
    [proyectoId]
  );

  const [ajustes, certificado] = await Promise.all([
    getAjustesUocraPorItem(proyectoId),
    getCertificadoPorItem(proyectoId),
  ]);

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

async function listarHojas(proyectoId) {
  const raices = await getArbolConRollups(proyectoId);
  const hojas = [];
  function recorrer(nodo) {
    if (nodo.esHoja) hojas.push(nodo);
    else nodo.hijos.forEach(recorrer);
  }
  raices.forEach(recorrer);
  return hojas;
}

async function buscarItem(proyectoId, itemId) {
  const idNum = Number(itemId);
  let encontrado = null;
  function recorrer(nodo) {
    if (encontrado) return;
    if (nodo.id === idNum) { encontrado = nodo; return; }
    nodo.hijos.forEach(recorrer);
  }
  (await getArbolConRollups(proyectoId)).forEach(recorrer);
  return encontrado;
}

async function resumenProyecto(proyectoId) {
  const raices = await getArbolConRollups(proyectoId);
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
