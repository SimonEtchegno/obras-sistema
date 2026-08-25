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

router.delete('/:id', (req, res) => {
  try {
    itemsTree.borrarItem(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
