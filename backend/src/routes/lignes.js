const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/lignes - List all routes
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM lignes ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lignes/:id - Get one route with its stations
router.get('/:id', async (req, res) => {
  try {
    const [lignes] = await pool.execute('SELECT * FROM lignes WHERE id = ?', [req.params.id]);
    if (lignes.length === 0) return res.status(404).json({ error: 'Ligne not found' });

    const [stations] = await pool.execute(
      'SELECT * FROM stations WHERE ligne_id = ? ORDER BY ordre',
      [req.params.id]
    );

    res.json({ ...lignes[0], stations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lignes - Add a route
router.post('/', async (req, res) => {
  try {
    const { nom, description } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO lignes (nom, description) VALUES (?, ?)',
      [nom, description]
    );
    res.status(201).json({ id: result.insertId, nom, description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/lignes/:id - Update a route
router.put('/:id', async (req, res) => {
  try {
    const { nom, description } = req.body;
    await pool.execute(
      'UPDATE lignes SET nom = ?, description = ? WHERE id = ?',
      [nom, description, req.params.id]
    );
    res.json({ message: 'Ligne updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/lignes/:id - Delete a route
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM lignes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ligne deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
