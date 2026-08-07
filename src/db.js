const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// En Vercel el disco es de solo lectura salvo /tmp, que además se borra entre
// ejecuciones: los datos NO persisten ahí. Es temporal hasta migrar a una base
// de datos online.
const dataDir = process.env.VERCEL ? '/tmp/obras-data' : path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'obras.db'));

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS proyecto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    fecha_presupuesto_original TEXT NOT NULL,
    monto_presupuesto_original REAL NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
    parent_id INTEGER REFERENCES item(id),
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    porcentaje REAL NOT NULL DEFAULT 0,
    monto_base REAL NOT NULL DEFAULT 0,
    monto_base_manual INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS certificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
    numero INTEGER,
    fecha TEXT NOT NULL,
    descripcion TEXT,
    fecha_creacion TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificacion_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificacion_id INTEGER NOT NULL REFERENCES certificacion(id),
    item_id INTEGER NOT NULL REFERENCES item(id),
    monto_vigente_snapshot REAL NOT NULL,
    porcentaje_certificado REAL,
    monto_certificado REAL NOT NULL,
    observaciones TEXT
  );

  CREATE TABLE IF NOT EXISTS actualizacion_uocra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
    fecha TEXT NOT NULL,
    porcentaje REAL NOT NULL,
    alcance TEXT NOT NULL,
    motivo TEXT,
    fecha_creacion TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS actualizacion_uocra_efecto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actualizacion_id INTEGER NOT NULL REFERENCES actualizacion_uocra(id),
    item_id INTEGER NOT NULL REFERENCES item(id),
    saldo_pendiente_antes REAL NOT NULL,
    monto_ajuste REAL NOT NULL,
    monto_vigente_despues REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_item_proyecto ON item(proyecto_id);
  CREATE INDEX IF NOT EXISTS idx_item_parent ON item(parent_id);
  CREATE INDEX IF NOT EXISTS idx_certdet_item ON certificacion_detalle(item_id);
  CREATE INDEX IF NOT EXISTS idx_certdet_cert ON certificacion_detalle(certificacion_id);
  CREATE INDEX IF NOT EXISTS idx_uocraefecto_item ON actualizacion_uocra_efecto(item_id);
  CREATE INDEX IF NOT EXISTS idx_uocraefecto_actualizacion ON actualizacion_uocra_efecto(actualizacion_id);
`);

module.exports = db;
