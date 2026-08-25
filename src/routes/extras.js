const express = require('express');
const extrasService = require('../services/extrasService');

const router = express.Router();

router.put('/:id', (req, res) => {
  try {
    res.json(extrasService.editarExtra(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    extrasService.eliminarExtra(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
