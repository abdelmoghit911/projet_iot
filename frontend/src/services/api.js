import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({ baseURL: API_BASE });

// --- Bus ---
export const getBuses = () => api.get('/bus');
export const getBus = (id) => api.get(`/bus/${id}`);
export const getBusPosition = (id) => api.get(`/bus/${id}/position`);
export const getBusTelemetry = (id) => api.get(`/bus/${id}/telemetrie`);
export const getBusPositions = (id, from, to) =>
  api.get(`/bus/${id}/positions`, { params: { from, to } });
export const getBusTelemetries = (id, from, to) =>
  api.get(`/bus/${id}/telemetries`, { params: { from, to } });
export const createBus = (data) => api.post('/bus', data);
export const updateBus = (id, data) => api.put(`/bus/${id}`, data);
export const deleteBus = (id) => api.delete(`/bus/${id}`);

// --- Lignes ---
export const getLignes = () => api.get('/lignes');
export const getLigne = (id) => api.get(`/lignes/${id}`);
export const createLigne = (data) => api.post('/lignes', data);
export const updateLigne = (id, data) => api.put(`/lignes/${id}`, data);
export const deleteLigne = (id) => api.delete(`/lignes/${id}`);

// --- Stations ---
export const getStations = () => api.get('/stations');
export const getStation = (id) => api.get(`/stations/${id}`);
export const createStation = (data) => api.post('/stations', data);
export const updateStation = (id, data) => api.put(`/stations/${id}`, data);
export const deleteStation = (id) => api.delete(`/stations/${id}`);

// --- Alerts ---
export const getAlerts = (resolved) =>
  api.get('/alerts', { params: resolved !== undefined ? { resolved } : {} });
export const resolveAlert = (id) => api.put(`/alerts/${id}/resolve`);

export default api;
