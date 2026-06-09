const { Server } = require('socket.io');
const { publishToMQTT } = require('../mqtt/subscriber');

let io = null;

function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on('bus:set_route', (data) => {
      console.log(`[WS] Custom route received for Bus ${data.bus_id}`);
      publishToMQTT(`bus/${data.bus_id}/control/route`, data.coords);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[WS] WebSocket server initialized');
  return io;
}

function getIO() {
  return io;
}

module.exports = { initWebSocket, getIO };
