const { Pool } = require('pg');

// Postgres online (Supabase) — reemplaza al SQLite local, que en Vercel no
// persistía (disco de solo lectura salvo /tmp, borrado entre ejecuciones).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function query(text, params) {
  return pool.query(text, params);
}

// Para los pasos que antes usaban db.exec('BEGIN'/'COMMIT'/'ROLLBACK') sobre
// la conexión única de SQLite: acá hace falta un mismo client de principio a
// fin, y devolverlo al pool pase lo que pase.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction };
