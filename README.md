# CloudHopper

CloudHopper is a dual-screen multiplayer party game.

- Landing at `/`: host or join entry screen.
- TV/Big Screen at `/tv`: live 3D globe, room code, leaderboard, round controls.
- Phone Controller at `/phone`: sector launchpad map for route slingshots and pass-offs.
- Real-time sync via Socket.IO for launches, scoring, and inbound handoffs.

## Gameplay Loop

1. Open the TV view and generate a 4-letter room code.
2. Players join from phones using the room code.
3. Each player controls one global sector.
4. Draw from a hub to another hub for local routes.
5. Draw from a hub to the map edge to pass flights to another sector.
6. Flights animate on the globe and arrive as inbound dots for the next sector player.
7. Host starts the round timer and everyone races for score until round end.

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

- Landing: `http://localhost:5173/`
- TV host: `http://localhost:5173/tv`
- Phone controllers: `http://localhost:5173/phone`

## Round System

- Room phases: `lobby` -> `live` -> `ended`
- Round duration: 95 seconds
- TV host controls round start and room reset
- Points are awarded per route based on route span and cross-sector bonus
- TV leaderboard and phone personal score update in real-time

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

`room:state` payload:

```json
{
  "code": "PLAY",
  "phase": "live",
  "round": 1,
  "roundEndsAt": 1760000000000,
  "playerCount": 4,
  "leaderboard": [
    {
      "playerId": "abc123",
      "playerName": "Nova",
      "sector": "Europe",
      "score": 104
    }
  ]
}
```
