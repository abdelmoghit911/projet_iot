import React, { useState } from 'react';
import { getBuses, getBusPositions, getBusTelemetries } from '../services/api';

function History() {
  const [buses, setBuses] = useState([]);
  const [busId, setBusId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState('positions');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load bus list on mount
  React.useEffect(() => {
    getBuses().then((res) => setBuses(res.data)).catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!busId) {
      setError('Veuillez sélectionner un bus.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let res;
      if (mode === 'positions') {
        res = await getBusPositions(busId, from || undefined, to || undefined);
      } else {
        res = await getBusTelemetries(busId, from || undefined, to || undefined);
      }
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-3">
      <h4 className="mb-3">📜 Historique des Données</h4>

      {/* Search Form */}
      <div className="card shadow-sm mb-4">
        <div className="card-header fw-bold">🔍 Recherche</div>
        <div className="card-body">
          <form onSubmit={handleSearch} className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Bus</label>
              <select
                className="form-select"
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
              >
                <option value="">-- Choisir --</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.numero} ({b.immatriculation})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="positions">Positions GPS</option>
                <option value="telemetries">Télémétrie</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Du</label>
              <input
                type="datetime-local"
                className="form-control"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Au</label>
              <input
                type="datetime-local"
                className="form-control"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                {loading ? 'Recherche...' : '🔍 Rechercher'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Results */}
      <div className="card shadow-sm">
        <div className="card-header fw-bold">
          📊 Résultats ({results.length})
        </div>
        <div className="card-body p-0" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <p className="text-muted p-3">Aucun résultat. Lancez une recherche.</p>
          ) : mode === 'positions' ? (
            <table className="table table-striped table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Bus</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Vitesse (km/h)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.bus_id}</td>
                    <td>{r.latitude}</td>
                    <td>{r.longitude}</td>
                    <td>{r.speed}</td>
                    <td>{new Date(r.date_position).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table table-striped table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Bus</th>
                  <th>Vitesse</th>
                  <th>Carburant</th>
                  <th>Temp. Moteur</th>
                  <th>Odomètre</th>
                  <th>Portes</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.bus_id}</td>
                    <td>{r.speed} km/h</td>
                    <td>{r.fuel}%</td>
                    <td>{r.engine_temp}°C</td>
                    <td>{r.odometer} km</td>
                    <td>{r.doors === 'open' ? '🔴' : '🟢'}</td>
                    <td>{new Date(r.date_reception).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default History;
