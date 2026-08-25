const db = require('../db');
const { listarHojas } = require('./rollups');

const TIPOS_VALIDOS = ['uocra', 'indice_construccion'];

function validarTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error('El tipo de actualización debe ser "uocra" o "indice_construccion".');
  }
}

// Supuesto de negocio (documentado en el plan, ajustable si el cliente real
// indica otro criterio): el % de aumento (por convenio UOCRA o por índice de
// la construcción) se aplica sobre el saldo pendiente (lo no certificado) de
// cada ítem del proyecto, no sobre lo ya certificado. Solo aplica a ítems
// "hoja", y siempre afecta a todo el proyecto: no se puede elegir un
// subconjunto de ítems.
function elegirItemsObjetivo(proyectoId) {
  return listarHojas(proyectoId);
}

// El aumento se puede cargar de dos formas: como un % o como un monto total.
// El monto se reparte entre los ítems a prorrata de su saldo pendiente, que es
// lo mismo que aplicar el % que ese monto representa sobre el saldo total. Así
// el resto del cálculo es uno solo, sin importar cómo se cargó.
function porcentajeEfectivo(objetivo, { modo, porcentaje, monto }) {
  if (modo === 'monto') {
    const valor = Number(monto);
    if (!Number.isFinite(valor)) throw new Error('El monto de aumento no es un número válido.');
    const saldoTotal = objetivo.reduce((acc, item) => acc + item.saldo_pendiente, 0);
    if (saldoTotal <= 0) {
      throw new Error(
        'El proyecto no tiene saldo pendiente, así que no hay dónde repartir un monto de aumento. Cargalo como porcentaje o certificá menos.'
      );
    }
    return (valor / saldoTotal) * 100;
  }
  const valor = Number(porcentaje);
  if (!Number.isFinite(valor)) throw new Error('El porcentaje de aumento no es un número válido.');
  return valor;
}

function previsualizar(proyectoId, datos) {
  const objetivo = elegirItemsObjetivo(proyectoId);
  const pct = porcentajeEfectivo(objetivo, datos || {});
  return objetivo.map((item) => {
    const ajuste = item.saldo_pendiente * (pct / 100);
    return {
      item_id: item.id,
      item_nombre: item.nombre,
      saldo_pendiente_antes: item.saldo_pendiente,
      monto_ajuste: ajuste,
      monto_vigente_despues: item.monto_vigente + ajuste,
    };
  });
}

function crearActualizacion(proyectoId, datos) {
  const { fecha, tipo, motivo } = datos;
  validarTipo(tipo);
  const objetivo = elegirItemsObjetivo(proyectoId);
  // Se guarda siempre el % (el ingresado, o el que equivale al monto cargado):
  // es lo que necesita el cálculo, y el monto total queda igual registrado como
  // la suma de los efectos.
  const porcentaje = porcentajeEfectivo(objetivo, datos);

  db.exec('BEGIN');
  try {
    const fechaCreacion = new Date().toISOString();
    const resultado = db.prepare(`
      INSERT INTO actualizacion_uocra (proyecto_id, fecha, tipo, porcentaje, alcance, motivo, fecha_creacion)
      VALUES (?, ?, ?, ?, 'todos', ?, ?)
    `).run(proyectoId, fecha, tipo, porcentaje, motivo ?? null, fechaCreacion);
    const actualizacionId = resultado.lastInsertRowid;

    const efectos = [];
    for (const item of objetivo) {
      const saldoAntes = item.saldo_pendiente;
      const ajuste = saldoAntes * (porcentaje / 100);
      const vigenteDespues = item.monto_vigente + ajuste;
      db.prepare(`
        INSERT INTO actualizacion_uocra_efecto
          (actualizacion_id, item_id, saldo_pendiente_antes, monto_ajuste, monto_vigente_despues)
        VALUES (?, ?, ?, ?, ?)
      `).run(actualizacionId, item.id, saldoAntes, ajuste, vigenteDespues);
      efectos.push({
        item_id: item.id,
        item_nombre: item.nombre,
        saldo_pendiente_antes: saldoAntes,
        monto_ajuste: ajuste,
        monto_vigente_despues: vigenteDespues,
      });
    }

    db.exec('COMMIT');
    return { actualizacionId, efectos };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function listarActualizaciones(proyectoId) {
  return db.prepare(`
    SELECT a.*,
      (SELECT COALESCE(SUM(e.monto_ajuste), 0) FROM actualizacion_uocra_efecto e WHERE e.actualizacion_id = a.id) as total_ajuste
    FROM actualizacion_uocra a
    WHERE a.proyecto_id = ?
    ORDER BY a.fecha DESC, a.id DESC
  `).all(proyectoId);
}

function obtenerActualizacion(id) {
  const act = db.prepare('SELECT * FROM actualizacion_uocra WHERE id = ?').get(id);
  if (!act) return null;
  const efectos = db.prepare(`
    SELECT e.*, i.nombre as item_nombre
    FROM actualizacion_uocra_efecto e
    JOIN item i ON i.id = e.item_id
    WHERE e.actualizacion_id = ?
    ORDER BY e.id
  `).all(id);
  return { ...act, efectos };
}

function esLaMasReciente(proyectoId, actualizacionId) {
  const ultima = db.prepare(
    'SELECT id FROM actualizacion_uocra WHERE proyecto_id = ? ORDER BY fecha_creacion DESC, id DESC LIMIT 1'
  ).get(proyectoId);
  return !!ultima && ultima.id === Number(actualizacionId);
}

function eliminarActualizacion(id) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM actualizacion_uocra_efecto WHERE actualizacion_id = ?').run(id);
    db.prepare('DELETE FROM actualizacion_uocra WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  previsualizar,
  crearActualizacion,
  listarActualizaciones,
  obtenerActualizacion,
  esLaMasReciente,
  eliminarActualizacion,
};
