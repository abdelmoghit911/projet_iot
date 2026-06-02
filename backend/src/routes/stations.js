const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/stations - List all stations
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM stations ORDER BY ligne_id, ordre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stations/:id - Get one station
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM stations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Station not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stations - Add a station
router.post('/', async (req, res) => {
  try {
    const { nom, latitude, longitude, ligne_id, ordre } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO stations (nom, latitude, longitude, ligne_id, ordre) VALUES (?, ?, ?, ?, ?)',
      [nom, latitude, longitude, ligne_id, ordre || 0]
    );
    res.status(201).json({ id: result.insertId, nom, latitude, longitude, ligne_id, ordre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stations/:id - Update a station
router.put('/:id', async (req, res) => {
  try {
    const { nom, latitude, longitude, ligne_id, ordre } = req.body;
    await pool.execute(
      'UPDATE stations SET nom = ?, latitude = ?, longitude = ?, ligne_id = ?, ordre = ? WHERE id = ?',
      [nom, latitude, longitude, ligne_id, ordre, req.params.id]
    );
    res.json({ message: 'Station updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stations/:id - Delete a station
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM stations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Station deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
