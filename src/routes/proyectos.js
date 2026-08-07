const express = require('express');
const db = require('../db');
const { getArbolConRollups, resumenProyecto } = require('../services/rollups');
const itemsTree = require('../services/itemsTree');
const certificacionService = require('../services/certificacionService');
const uocraService = require('../services/uocraService');

const router = express.Router();

router.get('/', (req, res) => {
  const proyectos = db.prepare('SELECT * FROM proyecto WHERE activo = 1 ORDER BY fecha_creacion DESC').all();
  res.json(proyectos.map((p) => ({ ...p, resumen: resumenProyecto(p.id) })));
});

router.post('/', (req, res) => {
  const { nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original } = req.body;
  if (!nombre || !fecha_presupuesto_original || monto_presupuesto_original == null) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: nombre, fecha_presupuesto_original, monto_presupuesto_original.',
    });
  }
  const fechaCreacion = new Date().toISOString();
  const resultado = db.prepare(`
    INSERT INTO proyecto (nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original, activo, fecha_creacion)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(nombre, descripcion ?? null, fecha_presupuesto_original, monto_presupuesto_original, fechaCreacion);
  const proyecto = db.prepare('SELECT * FROM proyecto WHERE id = ?').get(resultado.lastInsertRowid);
  res.status(201).json(proyecto);
});

router.get('/:id', (req, res) => {
  const proyecto = db.prepare('SELECT * FROM proyecto WHERE id = ?').get(req.params.id);
  if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado.' });
  res.json({ ...proyecto, resumen: resumenProyecto(proyecto.id) });
});

router.put('/:id', (req, res) => {
  const proyecto = db.prepare('SELECT * FROM proyecto WHERE id = ?').get(req.params.id);
  if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado.' });
  const nombre = req.body.nombre ?? proyecto.nombre;
  const descripcion = req.body.descripcion ?? proyecto.descripcion;
  const fecha_presupuesto_original = req.body.fecha_presupuesto_original ?? proyecto.fecha_presupuesto_original;
  const monto_presupuesto_original = req.body.monto_presupuesto_original ?? proyecto.monto_presupuesto_original;
  db.prepare(`
    UPDATE proyecto SET nombre = ?, descripcion = ?, fecha_presupuesto_original = ?, monto_presupuesto_original = ?
    WHERE id = ?
  `).run(nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original, req.params.id);
  itemsTree.recomputeProyecto(req.params.id);
  res.json(db.prepare('SELECT * FROM proyecto WHERE id = ?').get(req.params.id));
});

router.patch('/:id/archivar', (req, res) => {
  db.prepare('UPDATE proyecto SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/resumen', (req, res) => {
  res.json(resumenProyecto(req.params.id));
});

router.get('/:id/items', (req, res) => {
  res.json(getArbolConRollups(req.params.id));
});

router.post('/:id/items', (req, res) => {
  const { nombre, parent_id, orden, porcentaje, monto_base, monto_base_manual } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El ítem necesita un nombre.' });
  try {
    const item = itemsTree.crearItem({
      proyecto_id: req.params.id,
      parent_id: parent_id || null,
      nombre,
      orden,
      porcentaje,
      monto_base,
      monto_base_manual,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/certificaciones', (req, res) => {
  res.json(certificacionService.listarCertificaciones(req.params.id));
});

router.post('/:id/certificaciones', (req, res) => {
  try {
    const resultado = certificacionService.crearCertificacion(req.params.id, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/actualizaciones-uocra', (req, res) => {
  res.json(uocraService.listarActualizaciones(req.params.id));
});

router.post('/:id/actualizaciones-uocra/preview', (req, res) => {
  try {
    res.json(uocraService.previsualizar(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/actualizaciones-uocra', (req, res) => {
  try {
    const resultado = uocraService.crearActualizacion(req.params.id, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
