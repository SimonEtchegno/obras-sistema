const express = require('express');
const certificacionService = require('../services/certificacionService');

const router = express.Router();

router.put('/:id', (req, res) => {
  try {
    certificacionService.editarCertificacion(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  certificacionService.eliminarCertificacion(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
