const { query } = require('../db');

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

async function crearItemsFijos(proyectoId) {
  async function crear(nodo, parentId, orden) {
    const { rows } = await query(`
      INSERT INTO item (proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual, activo, fijo, permite_subitems)
      VALUES ($1, $2, $3, $4, $5, 0, 0, 1, 1, $6)
      RETURNING id
    `, [proyectoId, parentId || null, nodo.nombre, orden, nodo.porcentaje, nodo.permiteSubitems ? 1 : 0]);
    const id = rows[0].id;
    for (const [i, hijo] of (nodo.hijos || []).entries()) await crear(hijo, id, i);
    return id;
  }
  for (const [i, raiz] of ITEMS_FIJOS.entries()) await crear(raiz, null, i);
  await recomputeProyecto(proyectoId);
}

async function getItem(id) {
  const { rows } = await query('SELECT * FROM item WHERE id = $1', [Number(id)]);
  return rows[0];
}

async function getProyecto(id) {
  const { rows } = await query('SELECT * FROM proyecto WHERE id = $1', [Number(id)]);
  return rows[0];
}

async function baseDelPadre(item) {
  if (item.parent_id) {
    const padre = await getItem(item.parent_id);
    return padre ? padre.monto_base : 0;
  }
  const proyecto = await getProyecto(item.proyecto_id);
  return proyecto ? proyecto.monto_presupuesto_original : 0;
}

// El monto_base de un ítem es porcentaje% de la base de su padre (o del
// presupuesto del proyecto si es raíz) — salvo que se haya sobrescrito a
// mano (monto_base_manual). Cambiar un ítem obliga a recalcular en cascada
// a todos sus descendientes no-manuales.
async function recomputeSubtree(itemId) {
  const item = await getItem(itemId);
  if (!item) return;
  if (!item.monto_base_manual) {
    const base = await baseDelPadre(item);
    const nuevoMonto = base * (item.porcentaje / 100);
    await query('UPDATE item SET monto_base = $1 WHERE id = $2', [nuevoMonto, itemId]);
  }
  const { rows: hijos } = await query('SELECT id FROM item WHERE parent_id = $1 AND activo = 1', [itemId]);
  for (const hijo of hijos) await recomputeSubtree(hijo.id);
}

async function recomputeProyecto(proyectoId) {
  const { rows: raices } = await query(
    'SELECT id FROM item WHERE proyecto_id = $1 AND parent_id IS NULL AND activo = 1',
    [proyectoId]
  );
  for (const r of raices) await recomputeSubtree(r.id);
}

// Los sub-ítems creados a mano no llevan % propio: siempre se reparten el
// 100% del padre en partes iguales entre todos los hermanos. Se recalcula
// cada vez que se agrega o se borra uno.
async function repartirHermanosPorIgual(parentId) {
  const { rows: hermanos } = await query(
    'SELECT id FROM item WHERE parent_id = $1 AND activo = 1 ORDER BY orden, id',
    [parentId]
  );
  if (!hermanos.length) return;
  const porcentajeIgual = 100 / hermanos.length;
  for (const h of hermanos) {
    await query('UPDATE item SET porcentaje = $1 WHERE id = $2', [porcentajeIgual, h.id]);
  }
}

async function crearItem({ proyecto_id, parent_id, nombre, orden }) {
  if (!parent_id) throw new Error('Los ítems del presupuesto son fijos: solo se pueden agregar sub-ítems dentro de un ítem que lo permita.');
  const padre = await getItem(parent_id);
  if (!padre || !padre.permite_subitems) {
    throw new Error('No se pueden agregar sub-ítems dentro de este ítem.');
  }
  const { rows } = await query(`
    INSERT INTO item (proyecto_id, parent_id, nombre, orden, porcentaje, monto_base, monto_base_manual, activo, fijo, permite_subitems)
    VALUES ($1, $2, $3, $4, 0, 0, 0, 1, 0, 0)
    RETURNING id
  `, [proyecto_id, parent_id, nombre, orden || 0]);
  const id = rows[0].id;
  await repartirHermanosPorIgual(parent_id);
  await recomputeSubtree(parent_id);
  return getItem(id);
}

// Un sub-ítem solo tiene nombre editable: su % (y por lo tanto su monto) es
// siempre automático, y su avance se corrige editando las certificaciones,
// no el ítem.
async function actualizarItem(id, cambios) {
  const actual = await getItem(id);
  if (!actual) throw new Error('Ítem no encontrado.');
  if (actual.fijo) throw new Error('Los ítems fijos del presupuesto no se pueden editar.');
  const nombre = cambios.nombre ?? actual.nombre;
  await query('UPDATE item SET nombre = $1 WHERE id = $2', [nombre, id]);
  return getItem(id);
}

async function borrarItem(id) {
  const item = await getItem(id);
  if (!item) return;
  if (item.fijo) throw new Error('Los ítems fijos del presupuesto no se pueden eliminar.');
  const { rows: hijos } = await query('SELECT id FROM item WHERE parent_id = $1', [id]);
  for (const hijo of hijos) await borrarItem(hijo.id);
  await query('DELETE FROM certificacion_detalle WHERE item_id = $1', [id]);
  await query('DELETE FROM actualizacion_uocra_efecto WHERE item_id = $1', [id]);
  await query('DELETE FROM item WHERE id = $1', [id]);
  if (item.parent_id) {
    await repartirHermanosPorIgual(item.parent_id);
    await recomputeSubtree(item.parent_id);
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
