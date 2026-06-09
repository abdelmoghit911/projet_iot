import axios from 'axios';

// Detect if we should run in demo mode (no backend needed)
export const IS_DEMO = !import.meta.env.VITE_API_URL && (
  window.location.hostname.endsWith('.pages.dev') ||
  window.location.search.includes('demo=true') ||
  import.meta.env.VITE_DEMO_MODE === 'true'
);

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_BASE });

// --- Mock Data Store for Demo Mode ---
let mockBuses = [
  { id: 1, immatriculation: '12345-A-1', numero: 'BUS001', etat: 'active' },
  { id: 2, immatriculation: '23456-B-2', numero: 'BUS002', etat: 'active' },
  { id: 3, immatriculation: '34567-C-3', numero: 'BUS003', etat: 'active' },
  { id: 4, immatriculation: '45678-D-4', numero: 'BUS004', etat: 'maintenance' },
  { id: 5, immatriculation: '56789-E-5', numero: 'BUS005', etat: 'active' }
];

let mockLignes = [
  { id: 1, nom: 'Ligne 1', description: 'Gare ONA - Maarif - Hay Hassani' },
  { id: 2, nom: 'Ligne 2', description: 'Place Mohammed V - Anfa - Sidi Bernoussi' },
  { id: 3, nom: 'Ligne 3', description: 'Aïn Diab - Corniche - Bd Zerktouni' }
];

let mockStations = [
  { id: 1, nom: 'Gare ONA', latitude: 33.5888, longitude: -7.5638, ligne_id: 1, ordre: 1 },
  { id: 2, nom: 'Place Mohammed V', latitude: 33.5912, longitude: -7.6183, ligne_id: 1, ordre: 2 },
  { id: 3, nom: 'Maarif', latitude: 33.5735, longitude: -7.6325, ligne_id: 1, ordre: 3 },
  { id: 4, nom: 'Hay Hassani', latitude: 33.5600, longitude: -7.6500, ligne_id: 1, ordre: 4 },
  
  { id: 5, nom: 'Place Mohammed V', latitude: 33.5912, longitude: -7.6183, ligne_id: 2, ordre: 1 },
  { id: 6, nom: 'Bd Zerktouni', latitude: 33.5850, longitude: -7.6250, ligne_id: 2, ordre: 2 },
  { id: 7, nom: 'Anfa', latitude: 33.5900, longitude: -7.6400, ligne_id: 2, ordre: 3 },
  { id: 8, nom: 'Sidi Bernoussi', latitude: 33.6100, longitude: -7.5000, ligne_id: 2, ordre: 4 },
  
  { id: 9, nom: 'Aïn Diab', latitude: 33.5800, longitude: -7.6700, ligne_id: 3, ordre: 1 },
  { id: 10, nom: 'Corniche', latitude: 33.5850, longitude: -7.6600, ligne_id: 3, ordre: 2 },
  { id: 11, nom: 'Bd Zerktouni', latitude: 33.5850, longitude: -7.6250, ligne_id: 3, ordre: 3 }
];

let mockAlerts = [
  { id: 1, bus_id: 1, type: 'Température Moteur', message: 'Température élevée (98°C)', severity: 'high', resolved: false, created_at: new Date().toISOString() },
  { id: 2, bus_id: 2, type: 'Survitesse', message: 'Vitesse de 85 km/h enregistrée', severity: 'medium', resolved: false, created_at: new Date().toISOString() }
];

// --- Bus ---
export const getBuses = () => IS_DEMO ? Promise.resolve({ data: mockBuses }) : api.get('/bus');
export const getBus = (id) => IS_DEMO ? Promise.resolve({ data: mockBuses.find(b => b.id === Number(id)) }) : api.get(`/bus/${id}`);

export const getBusPosition = (id) => IS_DEMO ? Promise.resolve({
  data: {
    bus_id: Number(id),
    latitude: 33.5888 + (Math.sin(Date.now() / 10000) * 0.01),
    longitude: -7.5638 + (Math.cos(Date.now() / 10000) * 0.01),
    speed: 42 + Math.floor(Math.random() * 10),
    date_position: new Date().toISOString()
  }
}) : api.get(`/bus/${id}/position`);

export const getBusTelemetry = (id) => IS_DEMO ? Promise.resolve({
  data: {
    bus_id: Number(id),
    speed: 42 + Math.floor(Math.random() * 10),
    fuel: Math.max(10, Math.floor(95 - (Date.now() / 100000) % 85)),
    engine_temp: 82 + Math.floor(Math.random() * 8),
    odometer: 124500 + Math.floor(Date.now() / 10000000),
    doors: Math.random() > 0.9 ? 'open' : 'closed',
    date_reception: new Date().toISOString()
  }
}) : api.get(`/bus/${id}/telemetrie`);

export const getBusPositions = (id, from, to) => {
  if (IS_DEMO) {
    const history = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      history.push({
        id: i,
        bus_id: Number(id),
        latitude: 33.5888 + (Math.sin((now - i * 60000) / 10000) * 0.01),
        longitude: -7.5638 + (Math.cos((now - i * 60000) / 10000) * 0.01),
        speed: 35 + (i % 5) * 5,
        date_position: new Date(now - i * 60000).toISOString()
      });
    }
    return Promise.resolve({ data: history });
  }
  return api.get(`/bus/${id}/positions`, { params: { from, to } });
};

export const getBusTelemetries = (id, from, to) => {
  if (IS_DEMO) {
    const history = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      history.push({
        id: i,
        bus_id: Number(id),
        speed: 35 + (i % 5) * 5,
        fuel: 75 - i * 0.2,
        engine_temp: 80 + (i % 3) * 2,
        odometer: 124500 + (10 - i) * 0.1,
        doors: 'closed',
        date_reception: new Date(now - i * 60000).toISOString()
      });
    }
    return Promise.resolve({ data: history });
  }
  return api.get(`/bus/${id}/telemetries`, { params: { from, to } });
};

export const createBus = (data) => {
  if (IS_DEMO) {
    const newBus = { id: mockBuses.length + 1, ...data };
    mockBuses.push(newBus);
    return Promise.resolve({ data: newBus });
  }
  return api.post('/bus', data);
};

export const updateBus = (id, data) => {
  if (IS_DEMO) {
    mockBuses = mockBuses.map(b => b.id === Number(id) ? { ...b, ...data } : b);
    return Promise.resolve({ data: { id: Number(id), ...data } });
  }
  return api.put(`/bus/${id}`, data);
};

export const deleteBus = (id) => {
  if (IS_DEMO) {
    mockBuses = mockBuses.filter(b => b.id !== Number(id));
    return Promise.resolve({ data: { success: true } });
  }
  return api.delete(`/bus/${id}`);
};

// --- Lignes ---
export const getLignes = () => IS_DEMO ? Promise.resolve({ data: mockLignes }) : api.get('/lignes');
export const getLigne = (id) => IS_DEMO ? Promise.resolve({ data: mockLignes.find(l => l.id === Number(id)) }) : api.get(`/lignes/${id}`);

export const createLigne = (data) => {
  if (IS_DEMO) {
    const newLigne = { id: mockLignes.length + 1, ...data };
    mockLignes.push(newLigne);
    return Promise.resolve({ data: newLigne });
  }
  return api.post('/lignes', data);
};

export const updateLigne = (id, data) => {
  if (IS_DEMO) {
    mockLignes = mockLignes.map(l => l.id === Number(id) ? { ...l, ...data } : l);
    return Promise.resolve({ data: { id: Number(id), ...data } });
  }
  return api.put(`/lignes/${id}`, data);
};

export const deleteLigne = (id) => {
  if (IS_DEMO) {
    mockLignes = mockLignes.filter(l => l.id !== Number(id));
    return Promise.resolve({ data: { success: true } });
  }
  return api.delete(`/lignes/${id}`);
};

// --- Stations ---
export const getStations = () => IS_DEMO ? Promise.resolve({ data: mockStations }) : api.get('/stations');
export const getStation = (id) => IS_DEMO ? Promise.resolve({ data: mockStations.find(s => s.id === Number(id)) }) : api.get(`/stations/${id}`);

export const createStation = (data) => {
  if (IS_DEMO) {
    const newStation = { id: mockStations.length + 1, ...data };
    mockStations.push(newStation);
    return Promise.resolve({ data: newStation });
  }
  return api.post('/stations', data);
};

export const updateStation = (id, data) => {
  if (IS_DEMO) {
    mockStations = mockStations.map(s => s.id === Number(id) ? { ...s, ...data } : s);
    return Promise.resolve({ data: { id: Number(id), ...data } });
  }
  return api.put(`/stations/${id}`, data);
};

export const deleteStation = (id) => {
  if (IS_DEMO) {
    mockStations = mockStations.filter(s => s.id !== Number(id));
    return Promise.resolve({ data: { success: true } });
  }
  return api.delete(`/stations/${id}`);
};

// --- Alerts ---
export const getAlerts = (resolved) => {
  if (IS_DEMO) {
    const filtered = resolved !== undefined
      ? mockAlerts.filter(a => a.resolved === resolved)
      : mockAlerts;
    return Promise.resolve({ data: filtered });
  }
  return api.get('/alerts', { params: resolved !== undefined ? { resolved } : {} });
};

export const resolveAlert = (id) => {
  if (IS_DEMO) {
    mockAlerts = mockAlerts.map(a => a.id === Number(id) ? { ...a, resolved: true } : a);
    return Promise.resolve({ data: { id: Number(id), resolved: true } });
  }
  return api.put(`/alerts/${id}/resolve`);
};

export default api;
