import { io } from "socket.io-client";

const defaultUrl = window.location.hostname === "localhost"
  ? "http://localhost:4000"
  : `${window.location.protocol}//${window.location.hostname}:4000`;

export const socket = io(import.meta.env.VITE_SOCKET_URL ?? defaultUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"]
});
