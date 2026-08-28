const { query } = require('../db');

// Extras: trabajos o gastos que se anotan al costado del presupuesto. No
// forman parte del árbol de ítems, así que no mueven el monto vigente ni el
// avance del proyecto — son un registro aparte, con su propio total.

function validarTitulo(titulo) {
  const limpio = (titulo ?? '').trim();
  if (!limpio) throw new Error('El extra necesita un título.');
  return limpio;
}

async function listarExtras(proyectoId) {
  const { rows: extras } = await query(
    'SELECT * FROM extra WHERE proyecto_id = $1 ORDER BY fecha_creacion DESC, id DESC',
    [proyectoId]
  );
  const total = extras.reduce((acc, e) => acc + e.monto, 0);
  return { extras, total };
}

async function crearExtra(proyectoId, datos) {
  const titulo = validarTitulo(datos?.titulo);
  const monto = Number(datos?.monto) || 0;
  const { rows } = await query(`
    INSERT INTO extra (proyecto_id, titulo, monto, fecha_creacion)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [proyectoId, titulo, monto, new Date().toISOString()]);
  return rows[0];
}

async function editarExtra(id, cambios) {
  const { rows } = await query('SELECT * FROM extra WHERE id = $1', [id]);
  const extra = rows[0];
  if (!extra) throw new Error('Extra no encontrado.');
  const titulo = cambios?.titulo !== undefined ? validarTitulo(cambios.titulo) : extra.titulo;
  const monto = cambios?.monto !== undefined && cambios.monto !== null ? Number(cambios.monto) || 0 : extra.monto;
  const { rows: actualizado } = await query(
    'UPDATE extra SET titulo = $1, monto = $2 WHERE id = $3 RETURNING *',
    [titulo, monto, id]
  );
  return actualizado[0];
}

async function eliminarExtra(id) {
  const { rows } = await query('SELECT * FROM extra WHERE id = $1', [id]);
  if (!rows[0]) throw new Error('Extra no encontrado.');
  await query('DELETE FROM extra WHERE id = $1', [id]);
}

module.exports = { listarExtras, crearExtra, editarExtra, eliminarExtra };
