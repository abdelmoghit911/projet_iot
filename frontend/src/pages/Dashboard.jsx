import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import socket from "../services/socket";
import { getBuses, getAlerts, resolveAlert, createBus } from "../services/api";

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

const busColors = ["#e74c3c", "#2ecc71", "#3498db", "#f39c12", "#9b59b6"];

const busIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
});

const startIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  shadowSize: [41, 41]
});

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

// Component to auto-fit map bounds (only when recenterTrigger is activated manually, recenterTrigger > 0)
function MapBounds({ positions, recenterTrigger }) {
  const map = useMap();
  const posRef = useRef(positions);
  const lastTrigger = useRef(-1);

  // Keep positions ref updated without triggering the effect
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);

  useEffect(() => {
    const currentPositions = posRef.current;
    if (currentPositions && currentPositions.length > 0 && recenterTrigger > 0 && recenterTrigger !== lastTrigger.current) {
      const bounds = L.latLngBounds(
        currentPositions.map((p) => [p.latitude, p.longitude]),
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      lastTrigger.current = recenterTrigger;
    }
  }, [map, recenterTrigger]);
  return null;
}

// Component to track a specific bus
function MapTracker({ trackedBusId, positions, trackTrigger }) {
  const map = useMap();
  const lastTrackedBusId = useRef(null);
  const lastTrigger = useRef(-1);

  useEffect(() => {
    if (!trackedBusId || !positions[trackedBusId]) return;
    const { latitude, longitude } = positions[trackedBusId];

    if (lastTrackedBusId.current !== trackedBusId || trackTrigger !== lastTrigger.current) {
      // First time selecting this bus, or user clicked it again: center and zoom in
      map.setView([latitude, longitude], 16, { animate: true });
      lastTrackedBusId.current = trackedBusId;
      lastTrigger.current = trackTrigger;
    } else {
      // Subsequent updates: smoothly pan map without changing zoom
      map.panTo([latitude, longitude], { animate: true, duration: 0.5 });
    }
  }, [trackedBusId, positions, trackTrigger, map]);

  return null;
}

function Dashboard() {
  const [buses, setBuses] = useState([]);
  const [positions, setPositions] = useState({});
  const [trails, setTrails] = useState({});
  const [telemetry, setTelemetry] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ connected: 0, offline: 0, total: 0 });
  
  // Custom routing states
  const [routingMode, setRoutingMode] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  
  // Tracking states
  const [trackedBusId, setTrackedBusId] = useState(null);
  const [trackTrigger, setTrackTrigger] = useState(0);
  
  const alertShown = useRef(new Set());

  const handleMapClick = (latlng) => {
    if (!routingMode) return;
    if (!startPoint) {
      setStartPoint([latlng.lat, latlng.lng]);
    } else if (!endPoint) {
      setEndPoint([latlng.lat, latlng.lng]);
      calculateRoute(startPoint, [latlng.lat, latlng.lng]);
    }
  };

  const calculateRoute = async (start, end) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
      );
      if (!res.ok) throw new Error("Erreur OSRM");
      const data = await res.json();
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error("Aucun itinéraire trouvé");
      }

      const geojson = data.routes[0].geometry;
      const coords = geojson.coordinates.map((p) => [p[1], p[0]]); // [lat, lon]

      // 1. Create a bus on the backend
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const resBus = await createBus({
        immatriculation: `ROUTE-${randomSuffix}`,
        numero: `BUS-RT-${randomSuffix}`,
        etat: 'active',
        latitude: start[0],
        longitude: start[1]
      });

      // Reload bus list
      getBuses().then((res) => setBuses(res.data));

      // 2. Emit the custom route coordinates to the backend via WebSocket
      socket.emit('bus:set_route', {
        bus_id: resBus.data.id,
        coords
      });

      alert(`Bus ${resBus.data.numero} créé ! Il va rouler sur la route calculée.`);
      
      // Reset
      setStartPoint(null);
      setEndPoint(null);
      setRoutingMode(false);
    } catch (err) {
      alert("Erreur de calcul de route: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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
      const point = [data.latitude, data.longitude];
      setPositions((prev) => ({
        ...prev,
        [data.bus_id]: {
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed,
          timestamp: data.timestamp,
        },
      }));
      // Track trail (last 100 points per bus)
      setTrails((prev) => {
        const existing = prev[data.bus_id] || [];
        const updated = [...existing, point];
        if (updated.length > 100) updated.shift();
        return { ...prev, [data.bus_id]: updated };
      });
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
            <div className="card-header fw-bold d-flex justify-content-between align-items-center">
              <span>📍 Carte Temps Réel</span>
              <div className="d-flex align-items-center gap-2">
                {loading && <span className="spinner-border spinner-border-sm text-primary" role="status"></span>}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  type="button"
                  onClick={() => setRecenterTrigger(prev => prev + 1)}
                  disabled={loading}
                >
                  🎯 Recadrer
                </button>
                <button
                  className={`btn btn-sm ${routingMode ? 'btn-danger' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setRoutingMode(!routingMode);
                    setStartPoint(null);
                    setEndPoint(null);
                  }}
                  disabled={loading}
                >
                  {routingMode ? '❌ Annuler Itinéraire' : '🗺️ Mode Itinéraire'}
                </button>
              </div>
            </div>
            <div className="card-body p-0 position-relative" style={{ height: "500px" }}>
              {routingMode && (
                <div className="position-absolute top-0 start-50 translate-middle-x mt-2 p-2 bg-dark text-white rounded shadow-sm opacity-85" style={{ zIndex: 1000, fontSize: "14px" }}>
                  {!startPoint 
                    ? "🖱️ Cliquez sur la carte pour définir le DÉPART" 
                    : "🖱️ Cliquez pour définir l'ARRIVÉE"}
                </div>
              )}
              <MapContainer
                center={[33.58, -7.62]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds positions={posArray} recenterTrigger={recenterTrigger} />
                <MapTracker trackedBusId={trackedBusId} positions={positions} trackTrigger={trackTrigger} />
                <MapClickHandler onClick={handleMapClick} />
                
                {/* Custom route planning markers */}
                {startPoint && (
                  <Marker position={startPoint} icon={startIcon}>
                    <Popup>Départ</Popup>
                  </Marker>
                )}
                {endPoint && (
                  <Marker position={endPoint} icon={endIcon}>
                    <Popup>Arrivée</Popup>
                  </Marker>
                )}
                
                {/* Bus trails (route path) */}
                {Object.entries(trails).map(([busId, points]) =>
                  points.length > 1 ? (
                    <Polyline
                      key={`trail-${busId}`}
                      positions={points}
                      pathOptions={{
                        color: busColors[parseInt(busId) % busColors.length],
                        weight: 4,
                        opacity: 0.7,
                      }}
                    />
                  ) : null,
                )}
                {/* Bus markers */}
                {posArray.map((pos, idx) => (
                  <Marker
                    key={idx}
                    position={[pos.latitude, pos.longitude]}
                    icon={busIcon}
                    eventHandlers={{
                      click: () => {
                        if (trackedBusId === pos.bus_id) {
                          setTrackedBusId(null);
                        } else {
                          setTrackedBusId(pos.bus_id);
                          setTrackTrigger(prev => prev + 1);
                        }
                      }
                    }}
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
              {trackedBusId && (
                <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3 p-2 bg-dark text-white rounded shadow-lg d-flex align-items-center gap-2" style={{ zIndex: 1000, opacity: 0.85, fontSize: "13px" }}>
                  <span className="fw-bold">🎥 Suivi de {buses.find(b => b.id === trackedBusId)?.numero || `Bus ${trackedBusId}`}</span>
                  <button className="btn btn-xs btn-outline-light py-0 px-2 btn-sm" style={{ fontSize: "11px" }} onClick={() => setTrackedBusId(null)}>Arrêter</button>
                </div>
              )}
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
                const isTracked = trackedBusId === bus.id;
                return (
                  <div
                    key={bus.id}
                    className={`border rounded p-2 mb-2 transition-all ${isTracked ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'bg-light'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (trackedBusId === bus.id) {
                        setTrackedBusId(null);
                      } else {
                        setTrackedBusId(bus.id);
                        setTrackTrigger(prev => prev + 1);
                      }
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <strong>{bus.numero}</strong>{" "}
                      <span
                        className={`badge ${bus.etat === "active" ? "bg-success" : "bg-secondary"}`}
                      >
                        {bus.etat}
                      </span>
                    </div>
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
