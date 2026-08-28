const { query, withTransaction } = require('../db');
const { listarHojas } = require('./rollups');

// Solo se puede certificar sobre ítems "hoja" (sin subdivisiones), para no
// contar dos veces el mismo presupuesto entre un ítem padre y sus hijos.
async function crearCertificacion(proyectoId, datos) {
  const hojas = new Map((await listarHojas(proyectoId)).map((h) => [h.id, h]));
  const avisos = [];

  const certificacionId = await withTransaction(async (client) => {
    const fechaCreacion = new Date().toISOString();
    const { rows } = await client.query(`
      INSERT INTO certificacion (proyecto_id, numero, fecha, descripcion, fecha_creacion)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [proyectoId, datos.numero ?? null, datos.fecha, datos.descripcion ?? null, fechaCreacion]);
    const certId = rows[0].id;

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

      await client.query(`
        INSERT INTO certificacion_detalle
          (certificacion_id, item_id, monto_vigente_snapshot, porcentaje_certificado, monto_certificado, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [certId, item.id, vigenteSnapshot, porcentaje ?? null, monto, d.observaciones ?? null]);

      const nuevoAcumulado = (item.certificado_acumulado || 0) + monto;
      if (vigenteSnapshot > 0 && nuevoAcumulado > vigenteSnapshot + 0.01) {
        avisos.push(
          `El ítem "${item.nombre}" queda certificado en ${((nuevoAcumulado / vigenteSnapshot) * 100).toFixed(1)}% (supera el 100%).`
        );
      }
    }

    return certId;
  });

  return { certificacionId, avisos };
}

// Historial "plano" para la solapa Certificaciones: una fila por ítem
// certificado (no por certificación), con la fecha y el título de la
// certificación a la que pertenece.
async function listarCertificacionesDetalladas(proyectoId) {
  const { rows } = await query(`
    SELECT d.id as detalle_id, c.id as certificacion_id, c.fecha, c.descripcion as titulo,
           i.id as item_id, i.nombre as item_nombre, d.monto_certificado
    FROM certificacion_detalle d
    JOIN certificacion c ON c.id = d.certificacion_id
    JOIN item i ON i.id = d.item_id
    WHERE c.proyecto_id = $1
    ORDER BY c.fecha DESC, c.id DESC, d.id DESC
  `, [proyectoId]);
  return rows;
}

// Cada certificación tiene un solo detalle (se carga de a un ítem por vez
// desde su propia tarjeta), así que editar la certificación es editar ese
// único detalle.
async function editarCertificacion(id, cambios) {
  const { rows: certRows } = await query('SELECT * FROM certificacion WHERE id = $1', [id]);
  const cert = certRows[0];
  if (!cert) throw new Error('Certificación no encontrada.');
  const { rows: detRows } = await query('SELECT * FROM certificacion_detalle WHERE certificacion_id = $1', [id]);
  const detalle = detRows[0];

  const fecha = cambios.fecha ?? cert.fecha;
  const titulo = cambios.titulo !== undefined ? cambios.titulo : cert.descripcion;
  await query('UPDATE certificacion SET fecha = $1, descripcion = $2 WHERE id = $3', [fecha, titulo ?? null, id]);

  if (detalle && cambios.monto !== undefined && cambios.monto !== null) {
    const monto = Number(cambios.monto);
    const porcentaje = detalle.monto_vigente_snapshot > 0 ? (monto / detalle.monto_vigente_snapshot) * 100 : null;
    await query('UPDATE certificacion_detalle SET monto_certificado = $1, porcentaje_certificado = $2 WHERE id = $3', [
      monto, porcentaje, detalle.id,
    ]);
  }
}

async function eliminarCertificacion(id) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM certificacion_detalle WHERE certificacion_id = $1', [id]);
    await client.query('DELETE FROM certificacion WHERE id = $1', [id]);
  });
}

module.exports = {
  crearCertificacion,
  listarCertificacionesDetalladas,
  editarCertificacion,
  eliminarCertificacion,
};
