import { io, Socket } from "socket.io-client";

// Set VITE_API_URL to your backend URL, e.g. https://my-backend.railway.app
// Leave empty string to connect to the same host (useful for local dev proxy).
const API_URL = import.meta.env.VITE_API_URL ?? "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}
