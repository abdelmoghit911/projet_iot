import { io } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
});

socket.on('connect', () => {
  console.log('[WS] Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[WS] Disconnected');
});

export default socket;
