const db = require('../db');

// Extras: trabajos o gastos que se anotan al costado del presupuesto. No
// forman parte del árbol de ítems, así que no mueven el monto vigente ni el
// avance del proyecto — son un registro aparte, con su propio total.

function validarTitulo(titulo) {
  const limpio = (titulo ?? '').trim();
  if (!limpio) throw new Error('El extra necesita un título.');
  return limpio;
}

function listarExtras(proyectoId) {
  const extras = db.prepare(
    'SELECT * FROM extra WHERE proyecto_id = ? ORDER BY fecha_creacion DESC, id DESC'
  ).all(proyectoId);
  const total = extras.reduce((acc, e) => acc + e.monto, 0);
  return { extras, total };
}

function crearExtra(proyectoId, datos) {
  const titulo = validarTitulo(datos?.titulo);
  const monto = Number(datos?.monto) || 0;
  const resultado = db.prepare(`
    INSERT INTO extra (proyecto_id, titulo, monto, fecha_creacion)
    VALUES (?, ?, ?, ?)
  `).run(proyectoId, titulo, monto, new Date().toISOString());
  return db.prepare('SELECT * FROM extra WHERE id = ?').get(resultado.lastInsertRowid);
}

function editarExtra(id, cambios) {
  const extra = db.prepare('SELECT * FROM extra WHERE id = ?').get(id);
  if (!extra) throw new Error('Extra no encontrado.');
  const titulo = cambios?.titulo !== undefined ? validarTitulo(cambios.titulo) : extra.titulo;
  const monto = cambios?.monto !== undefined && cambios.monto !== null ? Number(cambios.monto) || 0 : extra.monto;
  db.prepare('UPDATE extra SET titulo = ?, monto = ? WHERE id = ?').run(titulo, monto, id);
  return db.prepare('SELECT * FROM extra WHERE id = ?').get(id);
}

function eliminarExtra(id) {
  const extra = db.prepare('SELECT * FROM extra WHERE id = ?').get(id);
  if (!extra) throw new Error('Extra no encontrado.');
  db.prepare('DELETE FROM extra WHERE id = ?').run(id);
}

module.exports = { listarExtras, crearExtra, editarExtra, eliminarExtra };
