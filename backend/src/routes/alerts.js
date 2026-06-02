const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/alerts - List all alerts
router.get('/', async (req, res) => {
  try {
    const { resolved } = req.query;
    let query = 'SELECT a.*, b.numero as bus_numero FROM alertes a LEFT JOIN bus b ON a.bus_id = b.id';
    if (resolved !== undefined) {
      query += ' WHERE a.resolved = ?';
    }
    query += ' ORDER BY a.created_at DESC LIMIT 100';
    const params = resolved !== undefined ? [resolved === 'true' ? 1 : 0] : [];
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve - Resolve an alert
router.put('/:id/resolve', async (req, res) => {
  try {
    await pool.execute('UPDATE alertes SET resolved = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
