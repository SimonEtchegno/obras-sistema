const express = require('express');
const extrasService = require('../services/extrasService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.put('/:id', asyncHandler(async (req, res) => {
  try {
    res.json(await extrasService.editarExtra(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    await extrasService.eliminarExtra(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

module.exports = router;
