import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import socket from "../services/socket";
import { getBuses, getAlerts, resolveAlert } from "../services/api";

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const busIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
});

// Component to auto-fit map bounds
function MapBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(
        positions.map((p) => [p.latitude, p.longitude]),
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions, map]);
  return null;
}

function Dashboard() {
  const [buses, setBuses] = useState([]);
  const [positions, setPositions] = useState({});
  const [telemetry, setTelemetry] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ connected: 0, offline: 0, total: 0 });
  const alertShown = useRef(new Set());

  // Fetch initial data
  useEffect(() => {
    getBuses()
      .then((res) => setBuses(res.data))
      .catch(console.error);
    getAlerts(false)
      .then((res) => {
        setAlerts(res.data.slice(0, 10));
        res.data.forEach((a) => alertShown.current.add(a.id));
      })
      .catch(console.error);
  }, []);

  // WebSocket: position updates
  useEffect(() => {
    const handlePosition = (data) => {
      setPositions((prev) => ({
        ...prev,
        [data.bus_id]: {
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed,
          timestamp: data.timestamp,
        },
      }));
    };

    const handleTelemetry = (data) => {
      setTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: {
          speed: data.speed,
          fuel: data.fuel,
          engine_temp: data.engine_temp,
          odometer: data.odometer,
          doors: data.doors,
          timestamp: data.timestamp,
        },
      }));
    };

    const handleAlert = (data) => {
      if (!alertShown.current.has(data.id)) {
        alertShown.current.add(data.id);
        setAlerts((prev) => [data, ...prev].slice(0, 20));
      }
    };

    socket.on("bus:position", handlePosition);
    socket.on("bus:telemetry", handleTelemetry);
    socket.on("alert", handleAlert);

    return () => {
      socket.off("bus:position", handlePosition);
      socket.off("bus:telemetry", handleTelemetry);
      socket.off("alert", handleAlert);
    };
  }, []);

  // Calculate fleet stats
  useEffect(() => {
    const now = Date.now();
    const posBuses = Object.keys(positions).map(Number);
    const connected = posBuses.filter(
      (id) =>
        positions[id] &&
        now - new Date(positions[id].timestamp).getTime() < 60000,
    ).length;
    const total = buses.length;
    setStats({
      connected,
      offline: total - connected,
      total,
    });
  }, [positions, buses]);

  const handleResolve = async (id) => {
    await resolveAlert(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    );
  };

  const posArray = Object.values(positions);

  return (
    <div className="p-3">
      {/* Stats Row */}
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card bg-primary text-white shadow-sm">
            <div className="card-body text-center">
              <h5 className="card-title">🚛 Total Bus</h5>
              <h2>{stats.total}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-success text-white shadow-sm">
            <div className="card-body text-center">
              <h5 className="card-title">🟢 Connectés</h5>
              <h2>{stats.connected}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-danger text-white shadow-sm">
            <div className="card-body text-center">
              <h5 className="card-title">🔴 Hors ligne</h5>
              <h2>{stats.offline}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Map */}
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header fw-bold">📍 Carte Temps Réel</div>
            <div className="card-body p-0" style={{ height: "500px" }}>
              <MapContainer
                center={[33.58, -7.62]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds positions={posArray} />
                {posArray.map((pos, idx) => (
                  <Marker
                    key={idx}
                    position={[pos.latitude, pos.longitude]}
                    icon={busIcon}
                  >
                    <Popup>
                      <strong>Bus ID: {pos.bus_id}</strong>
                      <br />
                      Vitesse: {pos.speed} km/h
                      <br />
                      <small>{pos.timestamp}</small>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Vehicle Status + Alerts */}
        <div className="col-lg-4">
          {/* Vehicle Status */}
          <div className="card shadow-sm mb-3">
            <div className="card-header fw-bold">🚌 État des Véhicules</div>
            <div
              className="card-body"
              style={{ maxHeight: "300px", overflowY: "auto" }}
            >
              {buses.length === 0 && (
                <p className="text-muted">Aucun bus chargé.</p>
              )}
              {buses.map((bus) => {
                const telem = telemetry[bus.id];
                return (
                  <div
                    key={bus.id}
                    className="border rounded p-2 mb-2 bg-light"
                  >
                    <strong>{bus.numero}</strong>{" "}
                    <span
                      className={`badge ${bus.etat === "active" ? "bg-success" : "bg-secondary"}`}
                    >
                      {bus.etat}
                    </span>
                    {telem ? (
                      <div className="small mt-1">
                        🏎️ {telem.speed} km/h &nbsp;|&nbsp; ⛽ {telem.fuel}%
                        &nbsp;|&nbsp; 🌡️ {telem.engine_temp}°C
                        <br />
                        🚪 {telem.doors === "open"
                          ? "🔴 Ouverte"
                          : "🟢 Fermée"}{" "}
                        &nbsp;|&nbsp; 🔢 {telem.odometer} km
                      </div>
                    ) : (
                      <div className="small text-muted mt-1">
                        En attente de données...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts */}
          <div className="card shadow-sm border-danger">
            <div className="card-header bg-danger text-white fw-bold">
              ⚠️ Alertes
            </div>
            <div
              className="card-body"
              style={{ maxHeight: "250px", overflowY: "auto" }}
            >
              {alerts.filter((a) => !a.resolved).length === 0 && (
                <p className="text-muted">Aucune alerte active.</p>
              )}
              {alerts
                .filter((a) => !a.resolved)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`alert alert-${alert.severity === "critical" ? "danger" : alert.severity === "high" ? "warning" : "info"} p-2 mb-1 small d-flex justify-content-between align-items-center`}
                  >
                    <span>
                      <strong>[{alert.type}]</strong> {alert.message}
                    </span>
                    <button
                      className="btn btn-sm btn-outline-dark"
                      onClick={() => handleResolve(alert.id)}
                    >
                      ✓
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
