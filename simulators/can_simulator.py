"""
CAN Bus Simulator - Simulates vehicle telemetry data.
Publishes CAN bus data to MQTT every 5 seconds.
"""

import json
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
TOPIC = f"bus/{BUS_ID}/can"

INTERVAL = 5  # seconds between publishes


class BusTelemetry:
    """Simulates realistic vehicle telemetry values."""

    def __init__(self):
        self.speed = 0.0
        self.fuel = 100.0  # % full tank
        self.engine_temp = 80.0  # °C
        self.odometer = 124500.0  # km
        self.doors = "closed"
        self.trip_distance = 0.0  # km this trip

    def update(self):
        """Update all values realistically."""
        # Speed: varies between 0 and 60 km/h
        if self.speed > 0 and random.random() < 0.1:
            # 10% chance of stopping
            self.speed = max(0, self.speed - random.uniform(10, 20))
        else:
            target = random.randint(30, 60)
            self.speed += (target - self.speed) * 0.3
            self.speed += random.uniform(-3, 3)
        self.speed = max(0, min(65, self.speed))
        self.speed = round(self.speed, 1)

        # Fuel: slowly decreasing
        self.fuel -= random.uniform(0.01, 0.05)
        self.fuel = max(1, round(self.fuel, 1))

        # Odometer: increases based on speed
        dist_km = (self.speed * INTERVAL) / 3600.0
        self.odometer += dist_km
        self.odometer = round(self.odometer, 1)
        self.trip_distance += dist_km

        # Engine temperature: higher when speed is higher
        base_temp = 75 + (self.speed / 60) * 25
        self.engine_temp = base_temp + random.uniform(-3, 5)
        # Occasionally spike temperature
        if random.random() < 0.03:
            self.engine_temp += random.uniform(10, 20)
        self.engine_temp = round(self.engine_temp, 1)

        # Doors: toggle occasionally
        if self.speed < 1 and random.random() < 0.15:
            self.doors = "open"
        elif self.speed > 0 and self.doors == "open":
            # Doors should close when moving
            if random.random() < 0.8:
                self.doors = "closed"
        else:
            self.doors = "closed"

    def to_dict(self):
        return {
            "bus_id": int(BUS_ID),
            "speed": self.speed,
            "fuel": self.fuel,
            "engine_temp": self.engine_temp,
            "odometer": self.odometer,
            "doors": self.doors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def main():
    client = mqtt.Client(client_id=f"can-sim-bus-{BUS_ID}")
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.max_queued_messages_set(10)

    print(f"[CAN] Connecting to MQTT at {MQTT_HOST}:{MQTT_PORT}...")
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()
    print(f"[CAN] Publishing to topic: {TOPIC}")

    telemetry = BusTelemetry()

    while True:
        telemetry.update()
        payload = telemetry.to_dict()

        client.publish(TOPIC, json.dumps(payload), qos=1)
        print(
            f"[CAN] Bus {BUS_ID}: speed={payload['speed']} km/h | "
            f"fuel={payload['fuel']}% | temp={payload['engine_temp']}°C | "
            f"odo={payload['odometer']} km | doors={payload['doors']}"
        )

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
