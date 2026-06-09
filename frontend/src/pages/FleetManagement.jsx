import React, { useEffect, useState } from 'react';
import { getBuses, createBus, updateBus, deleteBus } from '../services/api';

function FleetManagement() {
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({ immatriculation: '', numero: '', etat: 'active' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const loadBuses = () => {
    getBuses()
      .then((res) => setBuses(res.data))
      .catch((err) => setError('Erreur chargement: ' + err.message));
  };

  useEffect(() => {
    loadBuses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await updateBus(editing, form);
      } else {
        await createBus(form);
      }
      setForm({ immatriculation: '', numero: '', etat: 'active' });
      setEditing(null);
      loadBuses();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleGenerateRandomBus = async () => {
    setError('');
    try {
      const randomId = Math.floor(10000 + Math.random() * 90000);
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      const randomRegion = Math.floor(1 + Math.random() * 9);
      
      const immatriculation = `${randomId}-${randomLetter}-${randomRegion}`;
      const numero = `BUS${Math.floor(100 + Math.random() * 900)}`;
      
      // Casablanca area range: lat 33.55 to 33.61, lon -7.50 to -7.68
      const latitude = 33.55 + Math.random() * 0.06;
      const longitude = -7.68 + Math.random() * 0.12;

      await createBus({
        immatriculation,
        numero,
        etat: 'active',
        latitude,
        longitude
      });
      loadBuses();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleEdit = (bus) => {
    setForm({ immatriculation: bus.immatriculation, numero: bus.numero, etat: bus.etat });
    setEditing(bus.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce bus ?')) return;
    try {
      await deleteBus(id);
      loadBuses();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-3">
      <h4 className="mb-3">🚛 Gestion de la Flotte</h4>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Form */}
      <div className="card shadow-sm mb-4">
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          <span>{editing ? '✏️ Modifier un Bus' : '➕ Ajouter un Bus'}</span>
          {!editing && (
            <button
              className="btn btn-sm btn-outline-success"
              type="button"
              onClick={handleGenerateRandomBus}
            >
              🎲 Générer un Bus Aléatoire
            </button>
          )}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="row g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Immatriculation"
                value={form.immatriculation}
                onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
                required
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Numéro"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                required
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={form.etat}
                onChange={(e) => setForm({ ...form, etat: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" type="submit">
                {editing ? 'Modifier' : 'Ajouter'}
              </button>
              {editing && (
                <button
                  className="btn btn-secondary w-100 mt-1"
                  onClick={() => {
                    setEditing(null);
                    setForm({ immatriculation: '', numero: '', etat: 'active' });
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Bus Table */}
      <div className="card shadow-sm">
        <div className="card-header fw-bold">📋 Liste des Bus</div>
        <div className="card-body p-0">
          <table className="table table-striped table-hover mb-0">
            <thead className="table-dark">
              <tr>
                <th>ID</th>
                <th>Immatriculation</th>
                <th>Numéro</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.id}>
                  <td>{bus.id}</td>
                  <td>{bus.immatriculation}</td>
                  <td>{bus.numero}</td>
                  <td>
                    <span
                      className={`badge ${
                        bus.etat === 'active'
                          ? 'bg-success'
                          : bus.etat === 'maintenance'
                          ? 'bg-warning'
                          : 'bg-secondary'
                      }`}
                    >
                      {bus.etat}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(bus)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(bus.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {buses.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted">
                    Aucun bus enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FleetManagement;
