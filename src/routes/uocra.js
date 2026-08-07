const express = require('express');
const uocraService = require('../services/uocraService');

const router = express.Router();

router.get('/:id', (req, res) => {
  const act = uocraService.obtenerActualizacion(req.params.id);
  if (!act) return res.status(404).json({ error: 'Actualización no encontrada.' });
  res.json({ ...act, es_la_mas_reciente: uocraService.esLaMasReciente(act.proyecto_id, act.id) });
});

router.delete('/:id', (req, res) => {
  const act = uocraService.obtenerActualizacion(req.params.id);
  if (!act) return res.status(404).json({ error: 'Actualización no encontrada.' });
  const advertencia = !uocraService.esLaMasReciente(act.proyecto_id, act.id)
    ? 'Ojo: esta no era la actualización UOCRA más reciente del proyecto. Borrarla puede dejar inconsistentes los ajustes calculados después de ella.'
    : null;
  uocraService.eliminarActualizacion(req.params.id);
  res.json({ ok: true, advertencia });
});

module.exports = router;
