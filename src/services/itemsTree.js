const db = require('../db');

function getItem(id) {
  return db.prepare('SELECT * FROM item WHERE id = ?').get(Number(id));
}

function getProyecto(id) {
  return db.prepare('SELECT * FROM proyecto WHERE id = ?').get(Number(id));
}

function baseDelPadre(item) {
  if (item.parent_id) {
    const padre = getItem(item.parent_id);
    return padre ? padre.monto_base : 0;
  }
  const proyecto = getProyecto(item.proyecto_id);
  return proyecto ? proyecto.monto_presupuesto_original : 0;
}

// El monto_base de un ítem es porcentaje% de la base de su padre (o del
// presupuesto del proyecto si es raíz) — salvo que se haya sobrescrito a
// mano (monto_base_manual). Cambiar un ítem obliga a recalcular en cascada
// a todos sus descendientes no-manuales.
function recomputeSubtree(itemId) {
  const item = getItem(itemId);
  if (!item) return;
  if (!item.monto_base_manual) {
    const base = baseDelPadre(item);
    const nuevoMonto = base * (item.porcentaje / 100);
    db.prepare('UPDATE item SET monto_base = ? WHERE id = ?').run(nuevoMonto, itemId);
  }
  const hijos = db.prepare('SELECT id FROM item WHERE parent_id = ? AND activo = 1').all(itemId);
  for (const hijo of hijos) recomputeSubtree(hijo.id);
}

function recomputeProyecto(proyectoId) {
  const raices = db.prepare(
    'SELECT id FROM item WHERE proyecto_id = ? AND parent_id IS NULL AND activo = 1'
  ).all(proyectoId);
  for (const r of raices) recomputeSubtree(r.id);
}

function crearItem({ proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual }) {
  const esManual = monto_base_manual ? 1 : 0;
  const montoInicial = esManual && monto_base != null ? monto_base : 0;
  const resultado = db.prepare(`
    INSERT INTO item (proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(proyecto_id, parent_id || null, nombre, orden || 0, porcentaje || 0, montoInicial, esManual);
  const id = resultado.lastInsertRowid;
  recomputeSubtree(id);
  return getItem(id);
}

function actualizarItem(id, cambios) {
  const actual = getItem(id);
  if (!actual) throw new Error('Ítem no encontrado.');
  const nombre = cambios.nombre ?? actual.nombre;
  const orden = cambios.orden ?? actual.orden;
  const porcentaje = cambios.porcentaje ?? actual.porcentaje;
  const parent_id = cambios.parent_id !== undefined ? cambios.parent_id : actual.parent_id;

  let monto_base = actual.monto_base;
  let monto_base_manual = actual.monto_base_manual;
  if (cambios.monto_base !== undefined && cambios.monto_base !== null) {
    monto_base = cambios.monto_base;
    monto_base_manual = 1;
  }
  if (cambios.monto_base_manual !== undefined) {
    monto_base_manual = cambios.monto_base_manual ? 1 : 0;
  }

  if (parent_id) {
    let cursor = parent_id;
    while (cursor) {
      if (Number(cursor) === Number(id)) throw new Error('No se puede mover un ítem dentro de sí mismo.');
      const padre = getItem(cursor);
      cursor = padre ? padre.parent_id : null;
    }
  }

  db.prepare(`
    UPDATE item SET nombre = ?, orden = ?, porcentaje = ?, parent_id = ?, monto_base = ?, monto_base_manual = ?
    WHERE id = ?
  `).run(nombre, orden, porcentaje, parent_id || null, monto_base, monto_base_manual, id);

  recomputeSubtree(id);
  return getItem(id);
}

function archivarItem(id) {
  db.prepare('UPDATE item SET activo = 0 WHERE id = ?').run(id);
}

function tieneHistorial(id) {
  const cert = db.prepare('SELECT COUNT(*) as c FROM certificacion_detalle WHERE item_id = ?').get(id);
  const uocra = db.prepare('SELECT COUNT(*) as c FROM actualizacion_uocra_efecto WHERE item_id = ?').get(id);
  return cert.c > 0 || uocra.c > 0;
}

module.exports = {
  getItem,
  getProyecto,
  recomputeSubtree,
  recomputeProyecto,
  crearItem,
  actualizarItem,
  archivarItem,
  tieneHistorial,
};
