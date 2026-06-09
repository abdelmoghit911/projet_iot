"""
GPS Simulator - Simulates a bus moving along Ligne 1 route in Casablanca.
Publishes GPS positions to MQTT every 5 seconds.
"""

import json
import math
import os
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

# --- Configuration from environment ---
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER", "simulator")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "simulator123")
BUS_ID = os.getenv("BUS_ID", "1")
TOPIC = f"bus/{BUS_ID}/gps"

# --- Route: Ligne 1 stations (Casablanca) ---
ROUTE = [
    {"name": "Gare ONA", "lat": 33.5888, "lon": -7.5638},
    {"name": "Place Mohammed V", "lat": 33.5912, "lon": -7.6183},
    {"name": "Maarif", "lat": 33.5735, "lon": -7.6325},
    {"name": "Hay Hassani", "lat": 33.5600, "lon": -7.6500},
]

INTERVAL = 5  # seconds between publishes
STEPS_PER_SEGMENT = 20  # interpolation steps between stations


def interpolate(start, end, t):
    """Linear interpolation between two points."""
    lat = start["lat"] + (end["lat"] - start["lat"]) * t
    lon = start["lon"] + (end["lon"] - start["lon"]) * t
    return lat, lon


def distance_km(lat1, lon1, lat2, lon2):
    """Haversine distance between two coordinates in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def generate_speed():
    """Generate a realistic speed in km/h."""
    base = random.randint(25, 55)
    # Occasionally stop at a station (speed = 0)
    if random.random() < 0.05:
        return 0
    return base + random.uniform(-5, 5)


def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2, client_id=f"gps-sim-bus-{BUS_ID}"
    )
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.max_queued_messages_set(10)

    print(f"[GPS] Connecting to MQTT at {MQTT_HOST}:{MQTT_PORT}...")
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()
    print(f"[GPS] Publishing to topic: {TOPIC}")

    segment = 0  # current route segment
    step = 0  # step within segment
    direction = 1  # 1 = forward, -1 = backward

    while True:
        start_station = ROUTE[segment]
        end_station = ROUTE[segment + 1] if segment + 1 < len(ROUTE) else ROUTE[0]

        # Interpolate position
        t = step / STEPS_PER_SEGMENT
        lat, lon = interpolate(start_station, end_station, t)
        speed = generate_speed()

        payload = {
            "bus_id": int(BUS_ID),
            "latitude": round(lat, 7),
            "longitude": round(lon, 7),
            "speed": round(speed, 1),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        client.publish(TOPIC, json.dumps(payload), qos=1)
        print(
            f"[GPS] Bus {BUS_ID}: {start_station['name']} → {end_station['name']} "
            f"| pos=({lat:.4f}, {lon:.4f}) | speed={speed:.1f} km/h"
        )

        # Advance step
        step += 1
        if step >= STEPS_PER_SEGMENT:
            step = 0
            segment += direction
            # Reverse direction at ends
            if segment >= len(ROUTE) - 1:
                segment = len(ROUTE) - 2
                direction = -1
            elif segment <= 0:
                segment = 1
                direction = 1

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
