const express = require('express');
const { query } = require('../db');
const { getArbolConRollups, resumenProyecto } = require('../services/rollups');
const itemsTree = require('../services/itemsTree');
const certificacionService = require('../services/certificacionService');
const uocraService = require('../services/uocraService');
const extrasService = require('../services/extrasService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows: proyectos } = await query('SELECT * FROM proyecto WHERE activo = 1 ORDER BY fecha_creacion DESC');
  const conResumen = await Promise.all(proyectos.map(async (p) => ({ ...p, resumen: await resumenProyecto(p.id) })));
  res.json(conResumen);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original } = req.body;
  if (!nombre || !fecha_presupuesto_original || monto_presupuesto_original == null) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: nombre, fecha_presupuesto_original, monto_presupuesto_original.',
    });
  }
  const fechaCreacion = new Date().toISOString();
  const { rows } = await query(`
    INSERT INTO proyecto (nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original, activo, fecha_creacion)
    VALUES ($1, $2, $3, $4, 1, $5)
    RETURNING id
  `, [nombre, descripcion ?? null, fecha_presupuesto_original, monto_presupuesto_original, fechaCreacion]);
  await itemsTree.crearItemsFijos(rows[0].id);
  const { rows: proyectoRows } = await query('SELECT * FROM proyecto WHERE id = $1', [rows[0].id]);
  res.status(201).json(proyectoRows[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM proyecto WHERE id = $1', [req.params.id]);
  const proyecto = rows[0];
  if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado.' });
  res.json({ ...proyecto, resumen: await resumenProyecto(proyecto.id) });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM proyecto WHERE id = $1', [req.params.id]);
  const proyecto = rows[0];
  if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado.' });
  const nombre = req.body.nombre ?? proyecto.nombre;
  const descripcion = req.body.descripcion ?? proyecto.descripcion;
  const fecha_presupuesto_original = req.body.fecha_presupuesto_original ?? proyecto.fecha_presupuesto_original;
  const monto_presupuesto_original = req.body.monto_presupuesto_original ?? proyecto.monto_presupuesto_original;
  await query(`
    UPDATE proyecto SET nombre = $1, descripcion = $2, fecha_presupuesto_original = $3, monto_presupuesto_original = $4
    WHERE id = $5
  `, [nombre, descripcion, fecha_presupuesto_original, monto_presupuesto_original, req.params.id]);
  await itemsTree.recomputeProyecto(req.params.id);
  const { rows: actualizado } = await query('SELECT * FROM proyecto WHERE id = $1', [req.params.id]);
  res.json(actualizado[0]);
}));

router.patch('/:id/archivar', asyncHandler(async (req, res) => {
  await query('UPDATE proyecto SET activo = 0 WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/:id/resumen', asyncHandler(async (req, res) => {
  res.json(await resumenProyecto(req.params.id));
}));

router.get('/:id/items', asyncHandler(async (req, res) => {
  res.json(await getArbolConRollups(req.params.id));
}));

router.post('/:id/items', asyncHandler(async (req, res) => {
  const { nombre, parent_id, orden } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El ítem necesita un nombre.' });
  try {
    const item = await itemsTree.crearItem({
      proyecto_id: req.params.id,
      parent_id: parent_id || null,
      nombre,
      orden,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.get('/:id/certificaciones', asyncHandler(async (req, res) => {
  res.json(await certificacionService.listarCertificacionesDetalladas(req.params.id));
}));

router.post('/:id/certificaciones', asyncHandler(async (req, res) => {
  try {
    const resultado = await certificacionService.crearCertificacion(req.params.id, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.get('/:id/actualizaciones-uocra', asyncHandler(async (req, res) => {
  res.json(await uocraService.listarActualizaciones(req.params.id));
}));

router.post('/:id/actualizaciones-uocra/preview', asyncHandler(async (req, res) => {
  try {
    res.json(await uocraService.previsualizar(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.post('/:id/actualizaciones-uocra', asyncHandler(async (req, res) => {
  try {
    const resultado = await uocraService.crearActualizacion(req.params.id, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.get('/:id/extras', asyncHandler(async (req, res) => {
  res.json(await extrasService.listarExtras(req.params.id));
}));

router.post('/:id/extras', asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await extrasService.crearExtra(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

module.exports = router;
