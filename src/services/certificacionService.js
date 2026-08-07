const db = require('../db');
const { listarHojas } = require('./rollups');

// Solo se puede certificar sobre ítems "hoja" (sin subdivisiones), para no
// contar dos veces el mismo presupuesto entre un ítem padre y sus hijos.
function crearCertificacion(proyectoId, datos) {
  const hojas = new Map(listarHojas(proyectoId).map((h) => [h.id, h]));
  const avisos = [];

  db.exec('BEGIN');
  try {
    const fechaCreacion = new Date().toISOString();
    const resultado = db.prepare(`
      INSERT INTO certificacion (proyecto_id, numero, fecha, descripcion, fecha_creacion)
      VALUES (?, ?, ?, ?, ?)
    `).run(proyectoId, datos.numero ?? null, datos.fecha, datos.descripcion ?? null, fechaCreacion);
    const certificacionId = resultado.lastInsertRowid;

    for (const d of datos.detalles || []) {
      const item = hojas.get(Number(d.item_id));
      if (!item) {
        throw new Error(
          `El ítem ${d.item_id} no existe, está archivado, o tiene subdivisiones (solo se certifica sobre ítems finales).`
        );
      }
      const vigenteSnapshot = item.monto_vigente;
      let monto = d.monto_certificado;
      let porcentaje = d.porcentaje_certificado;
      if ((monto === undefined || monto === null) && porcentaje != null) {
        monto = vigenteSnapshot * (porcentaje / 100);
      } else if (monto != null && (porcentaje === undefined || porcentaje === null) && vigenteSnapshot > 0) {
        porcentaje = (monto / vigenteSnapshot) * 100;
      }
      if (monto == null) monto = 0;

      db.prepare(`
        INSERT INTO certificacion_detalle
          (certificacion_id, item_id, monto_vigente_snapshot, porcentaje_certificado, monto_certificado, observaciones)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(certificacionId, item.id, vigenteSnapshot, porcentaje ?? null, monto, d.observaciones ?? null);

      const nuevoAcumulado = (item.certificado_acumulado || 0) + monto;
      if (vigenteSnapshot > 0 && nuevoAcumulado > vigenteSnapshot + 0.01) {
        avisos.push(
          `El ítem "${item.nombre}" queda certificado en ${((nuevoAcumulado / vigenteSnapshot) * 100).toFixed(1)}% (supera el 100%).`
        );
      }
    }

    db.exec('COMMIT');
    return { certificacionId, avisos };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function listarCertificaciones(proyectoId) {
  return db.prepare(`
    SELECT c.*,
      (SELECT COALESCE(SUM(d.monto_certificado), 0) FROM certificacion_detalle d WHERE d.certificacion_id = c.id) as total_certificado
    FROM certificacion c
    WHERE c.proyecto_id = ?
    ORDER BY c.fecha DESC, c.id DESC
  `).all(proyectoId);
}

function obtenerCertificacion(id) {
  const cert = db.prepare('SELECT * FROM certificacion WHERE id = ?').get(id);
  if (!cert) return null;
  const detalles = db.prepare(`
    SELECT d.*, i.nombre as item_nombre
    FROM certificacion_detalle d
    JOIN item i ON i.id = d.item_id
    WHERE d.certificacion_id = ?
    ORDER BY d.id
  `).all(id);
  return { ...cert, detalles };
}

function actualizarCertificacion(id, cambios) {
  const actual = db.prepare('SELECT * FROM certificacion WHERE id = ?').get(id);
  if (!actual) throw new Error('Certificación no encontrada.');
  const numero = cambios.numero ?? actual.numero;
  const fecha = cambios.fecha ?? actual.fecha;
  const descripcion = cambios.descripcion ?? actual.descripcion;
  db.prepare('UPDATE certificacion SET numero = ?, fecha = ?, descripcion = ? WHERE id = ?')
    .run(numero, fecha, descripcion, id);
  return obtenerCertificacion(id);
}

function eliminarCertificacion(id) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM certificacion_detalle WHERE certificacion_id = ?').run(id);
    db.prepare('DELETE FROM certificacion WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  crearCertificacion,
  listarCertificaciones,
  obtenerCertificacion,
  actualizarCertificacion,
  eliminarCertificacion,
};
