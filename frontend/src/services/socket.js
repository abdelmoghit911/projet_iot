import { io } from 'socket.io-client';
import { IS_DEMO } from './api';

let socket;

if (IS_DEMO) {
  // Mock Socket implementation
  const listeners = {};
  
  socket = {
    on: (event, callback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    off: (event, callback) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    },
    emit: (event, data) => {
      console.log(`[Mock WS] Emit: ${event}`, data);
    },
    connect: () => {
      console.log('[Mock WS] Connected');
    },
    disconnect: () => {
      console.log('[Mock WS] Disconnected');
    }
  };

  // Casablanca route coordinates for in-browser simulation
  const routes = {
    1: [ // Ligne 1
      { lat: 33.5888, lon: -7.5638 },
      { lat: 33.5912, lon: -7.6183 },
      { lat: 33.5735, lon: -7.6325 },
      { lat: 33.5600, lon: -7.6500 }
    ],
    2: [ // Ligne 2
      { lat: 33.5912, lon: -7.6183 },
      { lat: 33.5850, lon: -7.6250 },
      { lat: 33.5900, lon: -7.6400 },
      { lat: 33.6100, lon: -7.5000 }
    ],
    3: [ // Ligne 3
      { lat: 33.5800, lon: -7.6700 },
      { lat: 33.5850, lon: -7.6600 },
      { lat: 33.5850, lon: -7.6250 }
    ]
  };

  // State for the 5 buses
  const busesState = {
    1: { bus_id: 1, routeId: 1, segment: 0, step: 0, direction: 1, fuel: 85, odometer: 124500, alertCooldowns: {} },
    2: { bus_id: 2, routeId: 2, segment: 0, step: 2, direction: 1, fuel: 72, odometer: 85200, alertCooldowns: {} },
    3: { bus_id: 3, routeId: 3, segment: 0, step: 5, direction: 1, fuel: 90, odometer: 94100, alertCooldowns: {} },
    4: { bus_id: 4, routeId: 1, segment: 2, step: 0, direction: -1, fuel: 12, odometer: 140200, alertCooldowns: {} }, // starts low fuel
    5: { bus_id: 5, routeId: 2, segment: 1, step: 3, direction: -1, fuel: 60, odometer: 105600, alertCooldowns: {} }
  };

  const triggerEvent = (event, payload) => {
    if (listeners[event]) {
      listeners[event].forEach(callback => callback(payload));
    }
  };

  // Run simulation interval every 4 seconds
  setInterval(() => {
    Object.keys(busesState).forEach(id => {
      const bus = busesState[id];
      const route = routes[bus.routeId];
      if (!route) return;

      // Handle segment stepping
      bus.step += bus.direction;
      const stepsCount = 10;
      if (bus.step >= stepsCount) {
        bus.step = 0;
        bus.segment += 1;
        if (bus.segment >= route.length - 1) {
          bus.segment = route.length - 2;
          bus.direction = -1;
          bus.step = stepsCount - 1;
        }
      } else if (bus.step < 0) {
        bus.step = stepsCount - 1;
        bus.segment -= 1;
        if (bus.segment < 0) {
          bus.segment = 0;
          bus.direction = 1;
          bus.step = 0;
        }
      }

      // Linear interpolation between stations
      const start = route[bus.segment];
      const end = route[bus.segment + 1] || start;
      const t = bus.step / stepsCount;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lon = start.lon + (end.lon - start.lon) * t;

      // Speed is 0 at stop points, random speed between 25 and 55 elsewhere
      const isAtStop = bus.step === 0 || bus.step === stepsCount - 1;
      let speed = isAtStop ? 0 : Math.floor(25 + Math.random() * 30);
      
      // Doors open when stopped, closed when moving
      const doors = speed === 0 ? 'open' : 'closed';

      // Slowly consume fuel
      bus.fuel = Math.max(1, Number((bus.fuel - 0.05 - (speed * 0.001)).toFixed(2)));
      if (bus.fuel <= 5) {
        bus.fuel = 95; // Refuel simulation
      }

      // Engine temp: base is 75, heats up with speed
      let engine_temp = speed > 0 ? Math.floor(75 + (speed * 0.3) + Math.random() * 4) : Math.floor(65 + Math.random() * 4);
      
      // Trigger temporary overheat warning for Bus 1 (5% chance)
      if (bus.bus_id === 1 && Math.random() > 0.95) {
        engine_temp = 99;
      }
      
      // Increment odometer
      const distance = (speed * 4) / 3600; // 4 seconds of travel
      bus.odometer = Number((bus.odometer + distance).toFixed(2));

      const timestamp = new Date().toISOString();

      // Broadcast position update
      triggerEvent('bus:position', {
        bus_id: bus.bus_id,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        speed,
        timestamp
      });

      // Broadcast telemetry update
      triggerEvent('bus:telemetry', {
        bus_id: bus.bus_id,
        speed,
        fuel: bus.fuel,
        engine_temp,
        odometer: bus.odometer,
        doors,
        timestamp
      });

      // Alert rules (30s cooldown prevents spamming)
      const now = Date.now();
      const checkCooldown = (type) => {
        if (!bus.alertCooldowns[type] || now - bus.alertCooldowns[type] > 30000) {
          bus.alertCooldowns[type] = now;
          return true;
        }
        return false;
      };

      if (engine_temp > 95 && checkCooldown('engine_overheat')) {
        triggerEvent('alert', {
          id: Math.floor(Math.random() * 10000),
          bus_id: bus.bus_id,
          type: 'engine_overheat',
          message: `Bus ${bus.bus_id}: Température moteur critique (${engine_temp}°C)`,
          severity: 'critical',
          created_at: timestamp
        });
      }

      if (bus.fuel < 15 && checkCooldown('low_fuel')) {
        triggerEvent('alert', {
          id: Math.floor(Math.random() * 10000),
          bus_id: bus.bus_id,
          type: 'low_fuel',
          message: `Bus ${bus.bus_id}: Niveau de carburant bas (${bus.fuel}%)`,
          severity: 'high',
          created_at: timestamp
        });
      }
    });
  }, 1000);

} else {
  // Standard WebSocket connection
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });
}

export default socket;
