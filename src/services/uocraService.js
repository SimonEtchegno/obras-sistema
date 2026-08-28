const { query, withTransaction } = require('../db');
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

async function previsualizar(proyectoId, datos) {
  const objetivo = await elegirItemsObjetivo(proyectoId);
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

async function crearActualizacion(proyectoId, datos) {
  const { fecha, tipo, motivo } = datos;
  validarTipo(tipo);
  const objetivo = await elegirItemsObjetivo(proyectoId);
  // Se guarda siempre el % (el ingresado, o el que equivale al monto cargado):
  // es lo que necesita el cálculo, y el monto total queda igual registrado como
  // la suma de los efectos.
  const porcentaje = porcentajeEfectivo(objetivo, datos);

  return withTransaction(async (client) => {
    const fechaCreacion = new Date().toISOString();
    const { rows } = await client.query(`
      INSERT INTO actualizacion_uocra (proyecto_id, fecha, tipo, porcentaje, alcance, motivo, fecha_creacion)
      VALUES ($1, $2, $3, $4, 'todos', $5, $6)
      RETURNING id
    `, [proyectoId, fecha, tipo, porcentaje, motivo ?? null, fechaCreacion]);
    const actualizacionId = rows[0].id;

    const efectos = [];
    for (const item of objetivo) {
      const saldoAntes = item.saldo_pendiente;
      const ajuste = saldoAntes * (porcentaje / 100);
      const vigenteDespues = item.monto_vigente + ajuste;
      await client.query(`
        INSERT INTO actualizacion_uocra_efecto
          (actualizacion_id, item_id, saldo_pendiente_antes, monto_ajuste, monto_vigente_despues)
        VALUES ($1, $2, $3, $4, $5)
      `, [actualizacionId, item.id, saldoAntes, ajuste, vigenteDespues]);
      efectos.push({
        item_id: item.id,
        item_nombre: item.nombre,
        saldo_pendiente_antes: saldoAntes,
        monto_ajuste: ajuste,
        monto_vigente_despues: vigenteDespues,
      });
    }

    return { actualizacionId, efectos };
  });
}

async function listarActualizaciones(proyectoId) {
  const { rows } = await query(`
    SELECT a.*,
      (SELECT COALESCE(SUM(e.monto_ajuste), 0) FROM actualizacion_uocra_efecto e WHERE e.actualizacion_id = a.id) as total_ajuste
    FROM actualizacion_uocra a
    WHERE a.proyecto_id = $1
    ORDER BY a.fecha DESC, a.id DESC
  `, [proyectoId]);
  return rows;
}

async function obtenerActualizacion(id) {
  const { rows: actRows } = await query('SELECT * FROM actualizacion_uocra WHERE id = $1', [id]);
  const act = actRows[0];
  if (!act) return null;
  const { rows: efectos } = await query(`
    SELECT e.*, i.nombre as item_nombre
    FROM actualizacion_uocra_efecto e
    JOIN item i ON i.id = e.item_id
    WHERE e.actualizacion_id = $1
    ORDER BY e.id
  `, [id]);
  return { ...act, efectos };
}

async function esLaMasReciente(proyectoId, actualizacionId) {
  const { rows } = await query(
    'SELECT id FROM actualizacion_uocra WHERE proyecto_id = $1 ORDER BY fecha_creacion DESC, id DESC LIMIT 1',
    [proyectoId]
  );
  const ultima = rows[0];
  return !!ultima && ultima.id === Number(actualizacionId);
}

async function eliminarActualizacion(id) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM actualizacion_uocra_efecto WHERE actualizacion_id = $1', [id]);
    await client.query('DELETE FROM actualizacion_uocra WHERE id = $1', [id]);
  });
}

module.exports = {
  previsualizar,
  crearActualizacion,
  listarActualizaciones,
  obtenerActualizacion,
  esLaMasReciente,
  eliminarActualizacion,
};
