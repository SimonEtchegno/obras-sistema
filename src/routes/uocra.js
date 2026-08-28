const express = require('express');
const uocraService = require('../services/uocraService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/:id', asyncHandler(async (req, res) => {
  const act = await uocraService.obtenerActualizacion(req.params.id);
  if (!act) return res.status(404).json({ error: 'Actualización no encontrada.' });
  res.json({ ...act, es_la_mas_reciente: await uocraService.esLaMasReciente(act.proyecto_id, act.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const act = await uocraService.obtenerActualizacion(req.params.id);
  if (!act) return res.status(404).json({ error: 'Actualización no encontrada.' });
  const advertencia = !(await uocraService.esLaMasReciente(act.proyecto_id, act.id))
    ? 'Ojo: esta no era la actualización UOCRA más reciente del proyecto. Borrarla puede dejar inconsistentes los ajustes calculados después de ella.'
    : null;
  await uocraService.eliminarActualizacion(req.params.id);
  res.json({ ok: true, advertencia });
}));

module.exports = router;
