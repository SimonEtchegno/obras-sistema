const express = require('express');
const itemsTree = require('../services/itemsTree');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const item = await itemsTree.actualizarItem(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    await itemsTree.borrarItem(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

module.exports = router;
