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

// Historial "plano" para la solapa Certificaciones: una fila por ítem
// certificado (no por certificación), con la fecha y el título de la
// certificación a la que pertenece.
function listarCertificacionesDetalladas(proyectoId) {
  return db.prepare(`
    SELECT d.id as detalle_id, c.id as certificacion_id, c.fecha, c.descripcion as titulo,
           i.id as item_id, i.nombre as item_nombre, d.monto_certificado
    FROM certificacion_detalle d
    JOIN certificacion c ON c.id = d.certificacion_id
    JOIN item i ON i.id = d.item_id
    WHERE c.proyecto_id = ?
    ORDER BY c.fecha DESC, c.id DESC, d.id DESC
  `).all(proyectoId);
}

// Cada certificación tiene un solo detalle (se carga de a un ítem por vez
// desde su propia tarjeta), así que editar la certificación es editar ese
// único detalle.
function editarCertificacion(id, cambios) {
  const cert = db.prepare('SELECT * FROM certificacion WHERE id = ?').get(id);
  if (!cert) throw new Error('Certificación no encontrada.');
  const detalle = db.prepare('SELECT * FROM certificacion_detalle WHERE certificacion_id = ?').get(id);

  const fecha = cambios.fecha ?? cert.fecha;
  const titulo = cambios.titulo !== undefined ? cambios.titulo : cert.descripcion;
  db.prepare('UPDATE certificacion SET fecha = ?, descripcion = ? WHERE id = ?').run(fecha, titulo ?? null, id);

  if (detalle && cambios.monto !== undefined && cambios.monto !== null) {
    const monto = Number(cambios.monto);
    const porcentaje = detalle.monto_vigente_snapshot > 0 ? (monto / detalle.monto_vigente_snapshot) * 100 : null;
    db.prepare('UPDATE certificacion_detalle SET monto_certificado = ?, porcentaje_certificado = ? WHERE id = ?')
      .run(monto, porcentaje, detalle.id);
  }
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
  listarCertificacionesDetalladas,
  editarCertificacion,
  eliminarCertificacion,
};
