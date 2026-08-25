const db = require('../db');

// Estructura fija de ítems que arma todo proyecto nuevo. Los ítems marcados
// con permiteSubitems son los únicos donde el usuario puede agregar
// sub-ítems propios (a mano); el resto de la estructura no se puede tocar.
const ITEMS_FIJOS = [
  {
    nombre: 'Cañerías',
    porcentaje: 44,
    hijos: [
      { nombre: 'Losas', porcentaje: 65, permiteSubitems: true },
      { nombre: 'Paredes', porcentaje: 35, permiteSubitems: true },
    ],
  },
  { nombre: 'Cableado y col. Llaves', porcentaje: 30, permiteSubitems: true },
  {
    nombre: 'Gabinetes y tableros',
    porcentaje: 10,
    hijos: [
      { nombre: 'TG y TGM', porcentaje: 60, permiteSubitems: true },
      { nombre: 'Resto de tableros', porcentaje: 40, permiteSubitems: true },
    ],
  },
  { nombre: 'Montantes', porcentaje: 10, permiteSubitems: true },
  { nombre: 'Baterías porteros', porcentaje: 2, permiteSubitems: true },
  { nombre: 'Conex. Bombas', porcentaje: 1, permiteSubitems: true },
  { nombre: 'Zanjeos Varios', porcentaje: 1, permiteSubitems: true },
  { nombre: 'Tab. AA', porcentaje: 2, permiteSubitems: true },
];

function crearItemsFijos(proyectoId) {
  function crear(nodo, parentId, orden) {
    const resultado = db.prepare(`
      INSERT INTO item (proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual, activo, fijo, permite_subitems)
      VALUES (?, ?, ?, ?, ?, 0, 0, 1, 1, ?)
    `).run(proyectoId, parentId || null, nodo.nombre, orden, nodo.porcentaje, nodo.permiteSubitems ? 1 : 0);
    const id = resultado.lastInsertRowid;
    (nodo.hijos || []).forEach((hijo, i) => crear(hijo, id, i));
    return id;
  }
  ITEMS_FIJOS.forEach((raiz, i) => crear(raiz, null, i));
  recomputeProyecto(proyectoId);
}

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

// Los sub-ítems creados a mano no llevan % propio: siempre se reparten el
// 100% del padre en partes iguales entre todos los hermanos. Se recalcula
// cada vez que se agrega o se borra uno.
function repartirHermanosPorIgual(parentId) {
  const hermanos = db.prepare('SELECT id FROM item WHERE parent_id = ? AND activo = 1 ORDER BY orden, id').all(parentId);
  if (!hermanos.length) return;
  const porcentajeIgual = 100 / hermanos.length;
  for (const h of hermanos) {
    db.prepare('UPDATE item SET porcentaje = ? WHERE id = ?').run(porcentajeIgual, h.id);
  }
}

function crearItem({ proyecto_id, parent_id, nombre, orden }) {
  if (!parent_id) throw new Error('Los ítems del presupuesto son fijos: solo se pueden agregar sub-ítems dentro de un ítem que lo permita.');
  const padre = getItem(parent_id);
  if (!padre || !padre.permite_subitems) {
    throw new Error('No se pueden agregar sub-ítems dentro de este ítem.');
  }
  const resultado = db.prepare(`
    INSERT INTO item (proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual, activo, fijo, permite_subitems)
    VALUES (?, ?, ?, ?, 0, 0, 0, 1, 0, 0)
  `).run(proyecto_id, parent_id, nombre, orden || 0);
  const id = resultado.lastInsertRowid;
  repartirHermanosPorIgual(parent_id);
  recomputeSubtree(parent_id);
  return getItem(id);
}

// Un sub-ítem solo tiene nombre editable: su % (y por lo tanto su monto) es
// siempre automático, y su avance se corrige editando las certificaciones,
// no el ítem.
function actualizarItem(id, cambios) {
  const actual = getItem(id);
  if (!actual) throw new Error('Ítem no encontrado.');
  if (actual.fijo) throw new Error('Los ítems fijos del presupuesto no se pueden editar.');
  const nombre = cambios.nombre ?? actual.nombre;
  db.prepare('UPDATE item SET nombre = ? WHERE id = ?').run(nombre, id);
  return getItem(id);
}

function borrarItem(id) {
  const item = getItem(id);
  if (!item) return;
  if (item.fijo) throw new Error('Los ítems fijos del presupuesto no se pueden eliminar.');
  const hijos = db.prepare('SELECT id FROM item WHERE parent_id = ?').all(id);
  for (const hijo of hijos) borrarItem(hijo.id);
  db.prepare('DELETE FROM certificacion_detalle WHERE item_id = ?').run(id);
  db.prepare('DELETE FROM actualizacion_uocra_efecto WHERE item_id = ?').run(id);
  db.prepare('DELETE FROM item WHERE id = ?').run(id);
  if (item.parent_id) {
    repartirHermanosPorIgual(item.parent_id);
    recomputeSubtree(item.parent_id);
  }
}

module.exports = {
  getItem,
  getProyecto,
  recomputeSubtree,
  recomputeProyecto,
  crearItemsFijos,
  crearItem,
  actualizarItem,
  borrarItem,
};
