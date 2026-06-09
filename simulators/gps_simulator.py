"""
Dynamic GPS Simulator - Automatically detects active buses in the database,
spawns threads for each bus, and publishes coordinates to MQTT.
"""

import json
import os
import random
import time
import urllib.request
import threading
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

# --- Configuration from environment ---
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER", "simulator")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "simulator123")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000")

def get_active_buses():
    try:
        url = f"{BACKEND_URL}/api/bus"
        with urllib.request.urlopen(url, timeout=5) as response:
            buses = json.loads(response.read().decode('utf-8'))
            return [b for b in buses if b['etat'] == 'active']
    except Exception as e:
        print(f"[GPS Simulator] Error fetching buses from backend API: {e}")
        return []

def get_stations_for_route(route_id):
    try:
        url = f"{BACKEND_URL}/api/stations"
        with urllib.request.urlopen(url, timeout=5) as response:
            stations = json.loads(response.read().decode('utf-8'))
            route_stations = [s for s in stations if s['ligne_id'] == route_id]
            route_stations.sort(key=lambda s: s['ordre'])
            return route_stations
    except Exception as e:
        print(f"[GPS Simulator] Error fetching stations for route {route_id}: {e}")
        return []

class GPSSimulatorThread(threading.Thread):
    def __init__(self, bus_id, client, stop_event):
        super().__init__()
        self.bus_id = bus_id
        self.client = client
        self.stop_event = stop_event
        self.route_id = ((bus_id - 1) % 3) + 1 # Assigns routes 1, 2, or 3
        self.topic = f"bus/{bus_id}/gps"

    def run(self):
        print(f"[GPS] Starting simulation thread for Bus {self.bus_id}")
        
        # 1. Fetch route stations from API
        stations = get_stations_for_route(self.route_id)
        if not stations:
            # Fallback coordinates if API fails
            stations = [
                {"nom": "Gare ONA", "latitude": 33.5888, "longitude": -7.5638},
                {"nom": "Place Mohammed V", "latitude": 33.5912, "longitude": -7.6183},
                {"nom": "Maarif", "latitude": 33.5735, "longitude": -7.6325},
                {"nom": "Hay Hassani", "latitude": 33.5600, "longitude": -7.6500},
            ]
        
        # 2. Fetch starting position (if custom starting coordinate is set in the DB)
        start_lat, start_lon = None, None
        try:
            url = f"{BACKEND_URL}/api/bus/{self.bus_id}/position"
            with urllib.request.urlopen(url, timeout=3) as response:
                pos = json.loads(response.read().decode('utf-8'))
                start_lat = float(pos['latitude'])
                start_lon = float(pos['longitude'])
        except Exception:
            pass # No start position in database, will use first station

        # 3. Create route list
        route_coords = [{"lat": float(s["latitude"]), "lon": float(s["longitude"]), "name": s["nom"]} for s in stations]
        
        if start_lat is not None and start_lon is not None:
            # Add custom start coordinates to the front of the route
            route_coords.insert(0, {"lat": start_lat, "lon": start_lon, "name": "Point de départ"})

        segment = 0
        step = 0
        steps_per_segment = 15
        direction = 1

        while not self.stop_event.is_set():
            if len(route_coords) < 2:
                time.sleep(2)
                continue

            start_pt = route_coords[segment]
            end_pt = route_coords[segment + 1] if segment + 1 < len(route_coords) else route_coords[0]

            # Linear interpolation
            t = step / steps_per_segment
            lat = start_pt["lat"] + (end_pt["lat"] - start_pt["lat"]) * t
            lon = start_pt["lon"] + (end_pt["lon"] - start_pt["lon"]) * t

            # Varies speed, speed is 0 at station points
            is_at_station = step == 0 or step == steps_per_segment
            speed = 0.0 if is_at_station else round(25.0 + random.uniform(5, 20), 1)

            payload = {
                "bus_id": self.bus_id,
                "latitude": round(lat, 7),
                "longitude": round(lon, 7),
                "speed": speed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            try:
                self.client.publish(self.topic, json.dumps(payload), qos=1)
                print(f"[GPS] Bus {self.bus_id} ({start_pt['name']} -> {end_pt['name']}): "
                      f"pos=({lat:.4f}, {lon:.4f}) | speed={speed} km/h")
            except Exception as e:
                print(f"[GPS] Error publishing for Bus {self.bus_id}: {e}")

            # Advance steps
            step += 1
            if step >= steps_per_segment:
                step = 0
                segment += direction
                if segment >= len(route_coords) - 1:
                    # Remove custom start point once we reach the regular route
                    if start_lat is not None and len(route_coords) > len(stations):
                        route_coords.pop(0)
                        start_lat = None # Prevents popping again
                        segment = 0
                    else:
                        segment = len(route_coords) - 2
                        direction = -1
                elif segment <= 0:
                    segment = 1
                    direction = 1

            # Wait 5 seconds checking stop event
            for _ in range(5):
                if self.stop_event.is_set():
                    break
                time.sleep(1)

        print(f"[GPS] Stopped thread for Bus {self.bus_id}")

def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2, client_id="gps-simulator-manager"
    )
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.max_queued_messages_set(10)

    print(f"[GPS] Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
    if MQTT_PORT == 8883:
        client.tls_set()
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()

    active_simulations = {} # bus_id -> (thread, stop_event)

    try:
        while True:
            # Poll backend for active buses
            active_buses = get_active_buses()
            active_ids = {b['id'] for b in active_buses}

            # 1. Start threads for new active buses
            for bus in active_buses:
                bus_id = bus['id']
                if bus_id not in active_simulations:
                    stop_event = threading.Event()
                    thread = GPSSimulatorThread(bus_id, client, stop_event)
                    thread.daemon = True
                    thread.start()
                    active_simulations[bus_id] = (thread, stop_event)

            # 2. Stop threads for deactivated/deleted buses
            for bus_id in list(active_simulations.keys()):
                if bus_id not in active_ids:
                    print(f"[GPS] Bus {bus_id} is no longer active. Stopping simulation...")
                    thread, stop_event = active_simulations[bus_id]
                    stop_event.set()
                    thread.join()
                    del active_simulations[bus_id]

            time.sleep(10) # check for changes every 10 seconds
    except KeyboardInterrupt:
        print("[GPS] Shutting down...")
        for bus_id, (thread, stop_event) in active_simulations.items():
            stop_event.set()
            thread.join()
        client.loop_stop()

if __name__ == "__main__":
    main()
