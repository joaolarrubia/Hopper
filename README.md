# CloudHopper

CloudHopper is a dual-screen multiplayer party game.

- TV/Big Screen at `/tv`: a live 3D globe and room code.
- Phone Controller at `/phone`: assigned sector map for route slingshots.
- Real-time sync via Socket.IO for launches and sector handoffs.

## Gameplay Loop

1. Open the TV view and generate a 4-letter room code.
2. Players join from phones using the room code.
3. Each player controls one global sector.
4. Draw from a hub to another hub for local routes.
5. Draw from a hub to the map edge to pass flights to another sector.
6. Flights animate on the globe and arrive as inbound dots for the next sector player.

## Tech Stack

- Frontend: React, TypeScript, Vite
- TV 3D Scene: React Three Fiber + Drei + Three.js
- Phone UX: Framer Motion + SVG route drawing
- Realtime: Express + Socket.IO

## Run Locally

```bash
npm install
npm run dev
```

- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:4000`

Open:

- TV host: `http://localhost:5173/tv`
- Phone controllers: `http://localhost:5173/phone`

## Build

```bash
npm run build
```

## Deployment Notes

- Frontend can be deployed to Vercel (or any static host).
- Realtime server can be deployed separately (Railway, Fly.io, Render, or a VPS).
- Set `VITE_SOCKET_URL` in frontend environment to your deployed websocket server URL.

## Room Events

`phone:launch` payload:

```json
{
  "roomCode": "PLAY",
  "originCode": "RIO",
  "destinationCode": "LON",
  "color": "#36c8ff"
}
```

`phone:launch` pass-off payload:

```json
{
  "roomCode": "PLAY",
  "originCode": "RIO",
  "targetSector": "Africa",
  "color": "#ff7f6b"
}
```
