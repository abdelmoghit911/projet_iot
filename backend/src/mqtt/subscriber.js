const mqtt = require("mqtt");
const pool = require("../models/db");
const { checkAlerts } = require("../alerts/checker");

let io = null; // Will be set by index.js
let client = null; // Will be set by startMQTT

function setSocketIO(socketIO) {
  io = socketIO;
}

function startMQTT() {
  const host = process.env.MQTT_HOST || "mosquitto";
  const port = process.env.MQTT_PORT || "1883";
  const user = process.env.MQTT_USER || "backend";
  const password = process.env.MQTT_PASSWORD || "backend123";

  const opts = {
    clientId: `siv-backend-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000,
  };
  if (user) opts.username = user;
  if (password) opts.password = password;

  const protocol = process.env.MQTT_PROTOCOL || (port === "8883" ? "mqtts" : "mqtt");
  client = mqtt.connect(`${protocol}://${host}:${port}`, opts);

  client.on("connect", () => {
    console.log("[MQTT] Connected to broker");

    // Subscribe to all bus GPS data
    client.subscribe("bus/+/gps", { qos: 1 }, (err) => {
      if (err) console.error("[MQTT] GPS subscription error:", err);
      else console.log("[MQTT] Subscribed to bus/+/gps");
    });

    // Subscribe to all bus CAN data
    client.subscribe("bus/+/can", { qos: 1 }, (err) => {
      if (err) console.error("[MQTT] CAN subscription error:", err);
      else console.log("[MQTT] Subscribed to bus/+/can");
    });
  });

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const busId = payload.bus_id;

      if (topic.endsWith("/gps")) {
        await handleGPS(busId, payload);
      } else if (topic.endsWith("/can")) {
        await handleCAN(busId, payload);
      }
    } catch (err) {
      console.error("[MQTT] Parse error:", err.message);
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT] Connection error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  return client;
}

async function handleGPS(busId, payload) {
  const { latitude, longitude, speed } = payload;
  try {
    await pool.execute(
      "INSERT INTO positions (bus_id, latitude, longitude, speed, date_position) VALUES (?, ?, ?, ?, NOW())",
      [busId, latitude, longitude, speed || 0],
    );

    // Emit real-time position to WebSocket clients
    if (io) {
      io.emit("bus:position", {
        bus_id: busId,
        latitude,
        longitude,
        speed: speed || 0,
        timestamp: payload.timestamp || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[DB] GPS insert error:", err.message);
  }
}

async function handleCAN(busId, payload) {
  const { speed, fuel, engine_temp, odometer, doors } = payload;
  try {
    await pool.execute(
      "INSERT INTO telemetrie (bus_id, speed, fuel, engine_temp, odometer, doors, date_reception) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [busId, speed, fuel, engine_temp, odometer, doors],
    );

    // Emit real-time telemetry to WebSocket clients
    if (io) {
      io.emit("bus:telemetry", {
        bus_id: busId,
        speed,
        fuel,
        engine_temp,
        odometer,
        doors,
        timestamp: payload.timestamp || new Date().toISOString(),
      });
    }

    // Check for alert conditions
    await checkAlerts(busId, payload, io);
  } catch (err) {
    console.error("[DB] CAN insert error:", err.message);
  }
}

function publishToMQTT(topic, payload) {
  if (client) {
    client.publish(topic, typeof payload === "string" ? payload : JSON.stringify(payload));
  } else {
    console.warn("[MQTT] Cannot publish, client not connected");
  }
}

module.exports = { startMQTT, setSocketIO, publishToMQTT };
