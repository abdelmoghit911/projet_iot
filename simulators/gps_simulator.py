"""
Dynamic GPS Simulator - Automatically detects active buses in the database,
spawns threads for each bus, listens for control messages to override routes,
and publishes coordinates to MQTT.
"""

import json
import os
import random
import time
import urllib.request
import threading
import math
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

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_road_route(coords):
    """
    Given a list of coordinates [{"lat": lat, "lon": lon, ...}],
    queries OSRM to get a continuous list of road coordinates.
    """
    if len(coords) < 2:
        return coords

    try:
        # Format the coordinates as lon,lat;lon,lat;...
        coord_strs = [f"{pt['lon']},{pt['lat']}" for pt in coords]
        path_str = ";".join(coord_strs)
        url = f"https://router.project-osrm.org/route/v1/driving/{path_str}?overview=full&geometries=geojson"
        
        print(f"[GPS Simulator] Querying OSRM for road route with {len(coords)} waypoints...")
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'gps-simulator-backend-app/1.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
            if "routes" in res_data and len(res_data["routes"]) > 0:
                route_geom = res_data["routes"][0]["geometry"]
                osrm_coords = route_geom["coordinates"]  # list of [lon, lat]
                
                road_coords = []
                for i, c in enumerate(osrm_coords):
                    road_coords.append({
                        "lat": float(c[1]),
                        "lon": float(c[0]),
                        "name": f"Road segment {i}"
                    })
                print(f"[GPS Simulator] Successfully resolved road route: {len(road_coords)} points.")
                return road_coords
            else:
                print(f"[GPS Simulator] No routes found in OSRM response, using direct path.")
    except Exception as e:
        print(f"[GPS Simulator] Failed to query OSRM: {e}. Falling back to direct path.")
    
    return coords

class GPSSimulatorThread(threading.Thread):
    def __init__(self, bus_id, client, stop_event):
        super().__init__()
        self.bus_id = bus_id
        self.client = client
        self.stop_event = stop_event
        self.route_id = ((bus_id - 1) % 3) + 1 # Assigns routes 1, 2, or 3
        self.topic = f"bus/{bus_id}/gps"
        self.route_coords = []
        self.segment = 0
        self.step = 0
        self.direction = 1

    def set_custom_route(self, coords):
        print(f"[GPS] Bus {self.bus_id}: Overriding route with custom path of {len(coords)} coordinates.")
        # coords is a list of [lat, lon]
        self.route_coords = [{"lat": float(pt[0]), "lon": float(pt[1]), "name": f"Voie {i}"} for i, pt in enumerate(coords)]
        self.segment = 0
        self.step = 0
        self.direction = 1

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

        # 3. Create route list if not already overridden by custom control MQTT message
        if not self.route_coords:
            route_coords = [{"lat": float(s["latitude"]), "lon": float(s["longitude"]), "name": s["nom"]} for s in stations]
            has_custom_start = (start_lat is not None and start_lon is not None)
            if has_custom_start:
                route_coords.insert(0, {"lat": start_lat, "lon": start_lon, "name": "Point de départ"})
            
            resolved = get_road_route(route_coords)
            if len(resolved) != len(route_coords):
                # OSRM was successful, so we have a dense road route.
                # Clear start_lat to prevent the popping logic from removing a single point.
                start_lat = None
            self.route_coords = resolved
            
            # Spacing optimization:
            # If the bus does NOT have a custom start position, start it at a random segment
            # along the route so that buses on the same route are distributed and spaced out.
            if not has_custom_start and len(self.route_coords) > 2:
                self.segment = random.randint(0, len(self.route_coords) - 2)
                self.step = 0

        while not self.stop_event.is_set():
            if len(self.route_coords) < 2:
                time.sleep(2)
                continue

            # Safely clamp segment index (handles custom routes changes)
            if self.segment >= len(self.route_coords) - 1:
                self.segment = 0

            start_pt = self.route_coords[self.segment]
            end_pt = self.route_coords[self.segment + 1] if self.segment + 1 < len(self.route_coords) else self.route_coords[0]

            # Calculate distance in meters
            dist = haversine_distance(start_pt["lat"], start_pt["lon"], end_pt["lat"], end_pt["lon"])
            
            # Calculate interpolation steps dynamically based on distance:
            # - For dense coordinates (road geometry), points are close (< 35m). Take 1 step (1 second) directly.
            # - For sparse coordinates (stations), interpolate at ~12 meters/sec (43 km/h).
            if dist < 35:
                steps = 1
            else:
                steps = max(2, int(dist / 12))

            # Interpolate coordinates
            t = self.step / steps
            lat = start_pt["lat"] + (end_pt["lat"] - start_pt["lat"]) * t
            lon = start_pt["lon"] + (end_pt["lon"] - start_pt["lon"]) * t

            speed_mps = dist / steps if steps > 0 else 0
            speed = round(speed_mps * 3.6, 1) # convert m/s to km/h

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
                      f"pos=({lat:.4f}, {lon:.4f}) | speed={speed} km/h | dist={dist:.1f}m | steps={steps}")
            except Exception as e:
                print(f"[GPS] Error publishing for Bus {self.bus_id}: {e}")

            # Advance steps
            self.step += 1
            if self.step >= steps:
                self.step = 0
                self.segment += self.direction
                if self.segment >= len(self.route_coords) - 1:
                    # Remove custom start point once we reach the regular route
                    if start_lat is not None and len(self.route_coords) > len(stations):
                        self.route_coords.pop(0)
                        start_lat = None
                        self.segment = 0
                    else:
                        self.segment = len(self.route_coords) - 2
                        self.direction = -1
                elif self.segment <= 0:
                    self.segment = 1
                    self.direction = 1

            # Wait 1 second checking stop event
            time.sleep(1)

        print(f"[GPS] Stopped thread for Bus {self.bus_id}")

def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2, client_id="gps-simulator-manager"
    )
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.max_queued_messages_set(10)

    active_simulations = {} # bus_id -> (thread, stop_event)
    pending_custom_routes = {} # bus_id -> coords

    # Callback when receiving dynamic route control updates
    def on_message(client, userdata, msg):
        topic = msg.topic
        try:
            parts = topic.split('/')
            if len(parts) == 4 and parts[2] == 'control' and parts[3] == 'route':
                bus_id = int(parts[1])
                coords = json.loads(msg.payload.decode('utf-8'))
                if bus_id in active_simulations:
                    print(f"[GPS] Received custom route for Bus {bus_id} with {len(coords)} points.")
                    thread, _ = active_simulations[bus_id]
                    thread.set_custom_route(coords)
                else:
                    print(f"[GPS] Storing custom route for pending/inactive Bus {bus_id}.")
                    pending_custom_routes[bus_id] = coords
        except Exception as e:
            print(f"[GPS] Error handling control message on topic {topic}: {e}")

    client.on_message = on_message

    print(f"[GPS] Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
    if MQTT_PORT == 8883:
        client.tls_set()
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    
    # Subscribe to route override commands
    client.subscribe("bus/+/control/route", qos=1)
    client.loop_start()

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
                    if bus_id in pending_custom_routes:
                        print(f"[GPS] Applying cached custom route for new Bus {bus_id}")
                        thread.set_custom_route(pending_custom_routes[bus_id])
                        del pending_custom_routes[bus_id]
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

            time.sleep(1) # check for changes every 1 second
    except KeyboardInterrupt:
        print("[GPS] Shutting down...")
        for bus_id, (thread, stop_event) in active_simulations.items():
            stop_event.set()
            thread.join()
        client.loop_stop()

if __name__ == "__main__":
    main()
