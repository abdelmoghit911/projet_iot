"""
Dynamic CAN Bus Simulator - Automatically detects active buses in the database,
spawns threads for each bus, and publishes telemetry to MQTT.
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
        print(f"[CAN Simulator] Error fetching buses from backend API: {e}")
        return []

class BusTelemetry:
    def __init__(self, bus_id):
        self.bus_id = bus_id
        self.speed = 0.0
        self.fuel = round(60.0 + random.uniform(5, 35), 1)  # % tank
        self.engine_temp = 80.0  # °C
        self.odometer = round(100000.0 + random.uniform(1000, 50000), 1)
        self.doors = "closed"
        self.interval = 1

    def update(self):
        # Speed: varies dynamically
        if self.speed > 0 and random.random() < 0.15:
            # Chance of stopping
            self.speed = max(0, self.speed - random.uniform(10, 20))
        else:
            target = random.randint(25, 60)
            self.speed += (target - self.speed) * 0.3
            self.speed += random.uniform(-2, 2)
        
        self.speed = max(0, min(65, self.speed))
        self.speed = round(self.speed, 1)

        # Fuel consumption
        self.fuel -= random.uniform(0.01, 0.04)
        if self.fuel < 10:
            self.fuel = 95.0 # Simulated refuel
        self.fuel = round(self.fuel, 1)

        # Odometer
        dist_km = (self.speed * self.interval) / 3600.0
        self.odometer = round(self.odometer + dist_km, 1)

        # Engine temp
        base_temp = 75 + (self.speed / 60) * 18
        self.engine_temp = base_temp + random.uniform(-2, 4)
        # 3% chance of high temperature warning
        if self.bus_id == 1 and random.random() < 0.03:
            self.engine_temp += random.uniform(10, 18)
        self.engine_temp = round(self.engine_temp, 1)

        # Doors open when stopped
        if self.speed < 1 and random.random() < 0.2:
            self.doors = "open"
        else:
            self.doors = "closed"

    def to_dict(self):
        return {
            "bus_id": self.bus_id,
            "speed": self.speed,
            "fuel": self.fuel,
            "engine_temp": self.engine_temp,
            "odometer": self.odometer,
            "doors": self.doors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

class CANSimulatorThread(threading.Thread):
    def __init__(self, bus_id, client, stop_event):
        super().__init__()
        self.bus_id = bus_id
        self.client = client
        self.stop_event = stop_event
        self.topic = f"bus/{bus_id}/can"
        self.telemetry = BusTelemetry(bus_id)

    def run(self):
        print(f"[CAN] Starting simulation thread for Bus {self.bus_id}")

        while not self.stop_event.is_set():
            self.telemetry.update()
            payload = self.telemetry.to_dict()

            try:
                self.client.publish(self.topic, json.dumps(payload), qos=1)
                print(f"[CAN] Bus {self.bus_id}: speed={payload['speed']} km/h | "
                      f"fuel={payload['fuel']}% | temp={payload['engine_temp']}°C | "
                      f"doors={payload['doors']}")
            except Exception as e:
                print(f"[CAN] Error publishing for Bus {self.bus_id}: {e}")

            # Sleep 1 second checking stop event
            time.sleep(1)

        print(f"[CAN] Stopped thread for Bus {self.bus_id}")

def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2, client_id="can-simulator-manager"
    )
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.max_queued_messages_set(10)

    print(f"[CAN] Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
    if MQTT_PORT == 8883:
        client.tls_set()
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()

    active_simulations = {}

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
                    thread = CANSimulatorThread(bus_id, client, stop_event)
                    thread.daemon = True
                    thread.start()
                    active_simulations[bus_id] = (thread, stop_event)

            # 2. Stop threads for deactivated/deleted buses
            for bus_id in list(active_simulations.keys()):
                if bus_id not in active_ids:
                    print(f"[CAN] Bus {bus_id} is no longer active. Stopping simulation...")
                    thread, stop_event = active_simulations[bus_id]
                    stop_event.set()
                    thread.join()
                    del active_simulations[bus_id]

            time.sleep(10) # check for updates every 10 seconds
    except KeyboardInterrupt:
        print("[CAN] Shutting down...")
        for bus_id, (thread, stop_event) in active_simulations.items():
            stop_event.set()
            thread.join()
        client.loop_stop()

if __name__ == "__main__":
    main()
