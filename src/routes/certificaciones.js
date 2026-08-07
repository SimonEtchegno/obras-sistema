const express = require('express');
const certificacionService = require('../services/certificacionService');

const router = express.Router();

router.get('/:id', (req, res) => {
  const cert = certificacionService.obtenerCertificacion(req.params.id);
  if (!cert) return res.status(404).json({ error: 'Certificación no encontrada.' });
  res.json(cert);
});

router.put('/:id', (req, res) => {
  try {
    res.json(certificacionService.actualizarCertificacion(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  certificacionService.eliminarCertificacion(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
