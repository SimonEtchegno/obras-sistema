-- Schema de Postgres para Supabase. Traducción 1:1 de las tablas que antes
-- vivían en SQLite (ver el historial de src/db.js). Ya aplicado a mano en el
-- proyecto de Supabase vía MCP — este archivo queda como referencia y para
-- poder recrear el schema en otro proyecto si hiciera falta.

CREATE TABLE IF NOT EXISTS proyecto (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_presupuesto_original TEXT NOT NULL,
  monto_presupuesto_original DOUBLE PRECISION NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
  parent_id INTEGER REFERENCES item(id),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  porcentaje DOUBLE PRECISION NOT NULL DEFAULT 0,
  monto_base DOUBLE PRECISION NOT NULL DEFAULT 0,
  monto_base_manual INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  fijo INTEGER NOT NULL DEFAULT 0,
  permite_subitems INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS certificacion (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
  numero INTEGER,
  fecha TEXT NOT NULL,
  descripcion TEXT,
  fecha_creacion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificacion_detalle (
  id SERIAL PRIMARY KEY,
  certificacion_id INTEGER NOT NULL REFERENCES certificacion(id),
  item_id INTEGER NOT NULL REFERENCES item(id),
  monto_vigente_snapshot DOUBLE PRECISION NOT NULL,
  porcentaje_certificado DOUBLE PRECISION,
  monto_certificado DOUBLE PRECISION NOT NULL,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS actualizacion_uocra (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'uocra',
  porcentaje DOUBLE PRECISION NOT NULL,
  alcance TEXT NOT NULL,
  motivo TEXT,
  fecha_creacion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actualizacion_uocra_efecto (
  id SERIAL PRIMARY KEY,
  actualizacion_id INTEGER NOT NULL REFERENCES actualizacion_uocra(id),
  item_id INTEGER NOT NULL REFERENCES item(id),
  saldo_pendiente_antes DOUBLE PRECISION NOT NULL,
  monto_ajuste DOUBLE PRECISION NOT NULL,
  monto_vigente_despues DOUBLE PRECISION NOT NULL
);

-- Los extras se llevan aparte del árbol de ítems a propósito: son un
-- registro al costado del presupuesto, no una parte de él.
CREATE TABLE IF NOT EXISTS extra (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id),
  titulo TEXT NOT NULL,
  monto DOUBLE PRECISION NOT NULL DEFAULT 0,
  fecha_creacion TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_proyecto ON item(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_item_parent ON item(parent_id);
CREATE INDEX IF NOT EXISTS idx_certdet_item ON certificacion_detalle(item_id);
CREATE INDEX IF NOT EXISTS idx_certdet_cert ON certificacion_detalle(certificacion_id);
CREATE INDEX IF NOT EXISTS idx_uocraefecto_item ON actualizacion_uocra_efecto(item_id);
CREATE INDEX IF NOT EXISTS idx_uocraefecto_actualizacion ON actualizacion_uocra_efecto(actualizacion_id);
CREATE INDEX IF NOT EXISTS idx_extra_proyecto ON extra(proyecto_id);
