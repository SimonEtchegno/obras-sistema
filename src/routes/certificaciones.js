const express = require('express');
const certificacionService = require('../services/certificacionService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.put('/:id', asyncHandler(async (req, res) => {
  try {
    await certificacionService.editarCertificacion(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await certificacionService.eliminarCertificacion(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
