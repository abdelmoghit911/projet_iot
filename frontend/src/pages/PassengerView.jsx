import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import socket from "../services/socket";
import { getLignes, getStations } from "../services/api";
import { calculateETA } from "../services/utils";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const stationIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function PassengerView() {
  const [lignes, setLignes] = useState([]);
  const [selectedLigne, setSelectedLigne] = useState(null);
  const [stations, setStations] = useState([]);
  const [busPositions, setBusPositions] = useState({});
  const [busTelemetry, setBusTelemetry] = useState({});
  const [etaMinutes, setEtaMinutes] = useState({});
  const mapRef = useRef(null);

  // Load lignes
  useEffect(() => {
    getLignes()
      .then((res) => setLignes(res.data))
      .catch(console.error);
  }, []);

  // WebSocket: track all bus positions
  useEffect(() => {
    const handlePosition = (data) => {
      setBusPositions((prev) => ({
        ...prev,
        [data.bus_id]: data,
      }));
    };
    const handleTelemetry = (data) => {
      setBusTelemetry((prev) => ({
        ...prev,
        [data.bus_id]: data,
      }));
    };
    socket.on("bus:position", handlePosition);
    socket.on("bus:telemetry", handleTelemetry);
    return () => {
      socket.off("bus:position", handlePosition);
      socket.off("bus:telemetry", handleTelemetry);
    };
  }, []);

  // When a ligne is selected, load its stations
  const handleSelectLigne = async (ligneId) => {
    const ligne = lignes.find((l) => l.id === parseInt(ligneId));
    setSelectedLigne(ligne);
    try {
      const res = await getStations();
      const filtered = res.data.filter((s) => s.ligne_id === parseInt(ligneId));
      setStations(filtered.sort((a, b) => a.ordre - b.ordre));
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate ETAs for all stations
  useEffect(() => {
    if (!stations.length) return;
    const etas = {};

    // Use bus 1 position for ETA calculation (first active bus)
    const busPos = busPositions[1];
    const busTel = busTelemetry[1];
    const avgSpeed = busTel?.speed || busPos?.speed || 30;

    stations.forEach((station) => {
      if (busPos) {
        etas[station.id] = calculateETA(
          busPos.latitude,
          busPos.longitude,
          station.latitude,
          station.longitude,
          avgSpeed,
        );
      }
    });
    setEtaMinutes(etas);
  }, [stations, busPositions, busTelemetry]);

  const busPosArray = Object.values(busPositions);

  return (
    <div className="p-3">
      <h4 className="mb-3">🧑 Interface Voyageur</h4>

      <div className="row g-3">
        {/* Ligne selector */}
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header fw-bold">🚏 Sélectionner une Ligne</div>
            <div className="card-body">
              <div className="row g-2">
                {lignes.map((ligne) => (
                  <div key={ligne.id} className="col-md-4">
                    <button
                      className={`btn w-100 ${
                        selectedLigne?.id === ligne.id
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => handleSelectLigne(ligne.id)}
                    >
                      {ligne.nom}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Map + Stations */}
        {selectedLigne && (
          <>
            <div className="col-lg-8">
              <div className="card shadow-sm">
                <div className="card-header fw-bold">
                  📍 {selectedLigne.nom} — {selectedLigne.description}
                </div>
                <div className="card-body p-0" style={{ height: "450px" }}>
                  <MapContainer
                    center={[33.58, -7.62]}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    ref={mapRef}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {/* Route line connecting all stations */}
                    {stations.length > 1 && (
                      <Polyline
                        positions={stations.map((s) => [
                          s.latitude,
                          s.longitude,
                        ])}
                        pathOptions={{
                          color: "#2196F3",
                          weight: 5,
                          opacity: 0.6,
                          dashArray: "10 6",
                        }}
                      />
                    )}
                    {/* Station markers */}
                    {stations.map((station) => (
                      <Marker
                        key={station.id}
                        position={[station.latitude, station.longitude]}
                        icon={stationIcon}
                      >
                        <Popup>
                          <strong>{station.nom}</strong>
                          <br />
                          {etaMinutes[station.id] !== undefined && (
                            <span>
                              🚌 Bus dans{" "}
                              <strong>{etaMinutes[station.id]} min</strong>
                            </span>
                          )}
                        </Popup>
                      </Marker>
                    ))}
                    {/* Bus markers */}
                    {busPosArray.map((pos, idx) => (
                      <Marker
                        key={`bus-${idx}`}
                        position={[pos.latitude, pos.longitude]}
                      >
                        <Popup>
                          <strong>Bus {pos.bus_id}</strong>
                          <br />
                          Vitesse: {pos.speed} km/h
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            </div>

            {/* Station list with ETAs */}
            <div className="col-lg-4">
              <div className="card shadow-sm">
                <div className="card-header fw-bold">
                  🚏 Arrêts — {selectedLigne.nom}
                </div>
                <div className="card-body p-0">
                  <ul className="list-group list-group-flush">
                    {stations.map((station, idx) => (
                      <li
                        key={station.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <span className="badge bg-secondary me-2">
                            {idx + 1}
                          </span>
                          {station.nom}
                        </div>
                        <span className="badge bg-primary rounded-pill">
                          {etaMinutes[station.id] !== undefined
                            ? `${etaMinutes[station.id]} min`
                            : "-- min"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {stations.length === 0 && (
                    <p className="text-muted p-3">
                      Aucune station pour cette ligne.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PassengerView;
