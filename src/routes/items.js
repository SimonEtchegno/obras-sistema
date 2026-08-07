const express = require('express');
const itemsTree = require('../services/itemsTree');

const router = express.Router();

router.put('/:id', (req, res) => {
  try {
    const item = itemsTree.actualizarItem(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/archivar', (req, res) => {
  itemsTree.archivarItem(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
