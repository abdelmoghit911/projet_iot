const pool = require('../models/db');

// Track last seen timestamps to detect offline buses
const lastSeen = new Map();

async function checkAlerts(busId, payload, io) {
  const now = Date.now();
  lastSeen.set(busId, now);

  const alerts = [];

  // 1. Engine temperature > 95°C
  if (payload.engine_temp && payload.engine_temp > 95) {
    alerts.push({
      type: 'engine_overheat',
      message: `Bus ${busId}: Engine temperature critical (${payload.engine_temp}°C)`,
      severity: 'critical',
    });
  }

  // 2. Fuel level < 15%
  if (payload.fuel !== undefined && payload.fuel < 15) {
    alerts.push({
      type: 'low_fuel',
      message: `Bus ${busId}: Low fuel level (${payload.fuel}%)`,
      severity: 'high',
    });
  }

  // 3. Doors open while moving
  if (payload.doors === 'open' && payload.speed > 0) {
    alerts.push({
      type: 'doors_open_moving',
      message: `Bus ${busId}: Doors open while moving at ${payload.speed} km/h!`,
      severity: 'critical',
    });
  }

  // Save alerts to DB and broadcast
  for (const alert of alerts) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO alertes (bus_id, type, message, severity) VALUES (?, ?, ?, ?)',
        [busId, alert.type, alert.message, alert.severity]
      );

      if (io) {
        io.emit('alert', {
          id: result.insertId,
          bus_id: busId,
          ...alert,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`[ALERT] ${alert.message}`);
    } catch (err) {
      console.error('[ALERT] Insert error:', err.message);
    }
  }
}

// Periodically check for offline buses (> 60 seconds no data)
setInterval(async () => {
  const now = Date.now();
  for (const [busId, timestamp] of lastSeen.entries()) {
    if (now - timestamp > 60000) {
      try {
        const [existing] = await pool.execute(
          "SELECT id FROM alertes WHERE bus_id = ? AND type = 'bus_offline' AND resolved = FALSE AND created_at > NOW() - INTERVAL 5 MINUTE",
          [busId]
        );

        if (existing.length === 0) {
          await pool.execute(
            'INSERT INTO alertes (bus_id, type, message, severity) VALUES (?, ?, ?, ?)',
            [busId, 'bus_offline', `Bus ${busId}: No data received for over 60 seconds`, 'high']
          );
          console.log(`[ALERT] Bus ${busId} is OFFLINE`);
        }
      } catch (err) {
        console.error('[ALERT] Offline check error:', err.message);
      }

      lastSeen.delete(busId);
    }
  }
}, 15000); // Check every 15 seconds

module.exports = { checkAlerts };
