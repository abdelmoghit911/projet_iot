const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/bus - List all buses
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM bus ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bus/:id - Get one bus
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM bus WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Bus not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bus/:id/position - Last known position
router.get('/:id/position', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM positions WHERE bus_id = ? ORDER BY date_position DESC LIMIT 1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No position data' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bus/:id/telemetrie - Latest telemetry
router.get('/:id/telemetrie', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM telemetrie WHERE bus_id = ? ORDER BY date_reception DESC LIMIT 1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No telemetry data' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bus/:id/positions?from=&to= - Position history
router.get('/:id/positions', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM positions WHERE bus_id = ?';
    const params = [req.params.id];

    if (from) { query += ' AND date_position >= ?'; params.push(from); }
    if (to)   { query += ' AND date_position <= ?'; params.push(to); }

    query += ' ORDER BY date_position DESC LIMIT 500';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bus/:id/telemetries?from=&to= - Telemetry history
router.get('/:id/telemetries', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM telemetrie WHERE bus_id = ?';
    const params = [req.params.id];

    if (from) { query += ' AND date_reception >= ?'; params.push(from); }
    if (to)   { query += ' AND date_reception <= ?'; params.push(to); }

    query += ' ORDER BY date_reception DESC LIMIT 500';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bus - Add a bus
router.post('/', async (req, res) => {
  try {
    const { immatriculation, numero, etat, latitude, longitude } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO bus (immatriculation, numero, etat) VALUES (?, ?, ?)',
      [immatriculation, numero, etat || 'active']
    );
    const busId = result.insertId;

    if (latitude !== undefined && longitude !== undefined) {
      await pool.execute(
        'INSERT INTO positions (bus_id, latitude, longitude, speed, date_position) VALUES (?, ?, ?, 0, NOW())',
        [busId, latitude, longitude]
      );
    }

    res.status(201).json({ id: busId, immatriculation, numero, etat, latitude, longitude });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bus/:id - Update a bus
router.put('/:id', async (req, res) => {
  try {
    const { immatriculation, numero, etat } = req.body;
    await pool.execute(
      'UPDATE bus SET immatriculation = ?, numero = ?, etat = ? WHERE id = ?',
      [immatriculation, numero, etat, req.params.id]
    );
    res.json({ message: 'Bus updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bus/:id - Delete a bus
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM bus WHERE id = ?', [req.params.id]);
    res.json({ message: 'Bus deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
