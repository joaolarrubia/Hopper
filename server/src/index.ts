import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { customAlphabet, nanoid } from "nanoid";
import { Server } from "socket.io";
import { hubs, sectorNeighbors, sectors } from "./data";
import { Hub, Player, Room, RoomPhase, SectorName } from "./types";

const ROUND_DURATION_MS = 95_000;

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

const codeFactory = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 4);
const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

function makeRoomCode(): string {
  let code = codeFactory();
  while (rooms.has(code)) {
    code = codeFactory();
  }
  return code;
}

function getRoomBySocket(socketId: string) {
  const roomCode = socketToRoom.get(socketId);
  if (!roomCode) {
    return null;
  }
  return rooms.get(roomCode) ?? null;
}

function pickTargetHub(origin: Hub, targetSector?: SectorName): Hub {
  if (!targetSector) {
    const sameSector = hubs.filter((hub) => hub.sector === origin.sector && hub.code !== origin.code);
    return sameSector[Math.floor(Math.random() * sameSector.length)] ?? origin;
  }

  const targets = hubs.filter((hub) => hub.sector === targetSector);
  return targets[Math.floor(Math.random() * targets.length)] ?? origin;
}

function pickAssignedSector(room: Room): SectorName | null {
  const used = new Set([...room.players.values()].map((player) => player.sector));
  return sectors.find((sector) => !used.has(sector)) ?? null;
}

function pickPlayerInSector(room: Room, sector: SectorName): Player | null {
  for (const player of room.players.values()) {
    if (player.sector === sector) {
      return player;
    }
  }
  return null;
}

function pointsForLaunch(origin: Hub, destination: Hub): number {
  const latSpan = Math.abs(origin.lat - destination.lat);
  const lngSpan = Math.abs(origin.lng - destination.lng);
  const travelWeight = Math.round((latSpan + lngSpan) / 20);
  const crossSectorBonus = origin.sector === destination.sector ? 6 : 20;
  return Math.max(8, travelWeight + crossSectorBonus);
}

function leaderboardFor(room: Room) {
  return [...room.players.values()]
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      sector: player.sector,
      score: room.scoreByPlayerId[player.id] ?? 0
    }))
    .sort((a, b) => b.score - a.score);
}

function emitRoomState(room: Room) {
  io.to(room.code).emit("room:state", {
    code: room.code,
    phase: room.phase,
    round: room.round,
    roundEndsAt: room.roundEndsAt,
    playerCount: room.players.size,
    leaderboard: leaderboardFor(room)
  });
}

function emitPlayers(room: Room) {
  io.to(room.code).emit("room:players", {
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      sector: player.sector,
      score: room.scoreByPlayerId[player.id] ?? 0
    }))
  });
}

function setPhase(room: Room, phase: RoomPhase) {
  room.phase = phase;
  emitRoomState(room);
}

function endRound(room: Room) {
  room.roundEndsAt = null;
  room.roundTimer = null;
  setPhase(room, "ended");
}

function startRound(room: Room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  room.round += 1;
  room.roundEndsAt = Date.now() + ROUND_DURATION_MS;
  setPhase(room, "live");

  room.roundTimer = setTimeout(() => {
    endRound(room);
  }, ROUND_DURATION_MS);
}

io.on("connection", (socket) => {
  socket.on("tv:create-room", () => {
    const code = makeRoomCode();
    const room: Room = {
      code,
      tvSocketId: socket.id,
      players: new Map(),
      phase: "lobby",
      round: 0,
      roundEndsAt: null,
      scoreByPlayerId: {},
      roundTimer: null
    };

    rooms.set(code, room);
    socketToRoom.set(socket.id, code);
    socket.join(code);

    socket.emit("room:created", { code });
    emitRoomState(room);
  });

  socket.on("tv:start-round", ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(String(roomCode || "").toUpperCase());
    if (!room || room.tvSocketId !== socket.id || room.players.size === 0) {
      return;
    }
    startRound(room);
  });

  socket.on("tv:reset-room", ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(String(roomCode || "").toUpperCase());
    if (!room || room.tvSocketId !== socket.id) {
      return;
    }

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    room.phase = "lobby";
    room.round = 0;
    room.roundEndsAt = null;
    room.scoreByPlayerId = {};
    for (const player of room.players.values()) {
      room.scoreByPlayerId[player.id] = 0;
    }

    emitPlayers(room);
    emitRoomState(room);
  });

  socket.on("phone:join-room", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const code = String(roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit("phone:error", { message: "Room not found." });
      return;
    }

    const sector = pickAssignedSector(room);
    if (!sector) {
      socket.emit("phone:error", { message: "Room is full." });
      return;
    }

    const player: Player = {
      id: nanoid(8),
      name: String(playerName || "Pilot").slice(0, 16),
      sector,
      socketId: socket.id
    };

    room.players.set(player.id, player);
    room.scoreByPlayerId[player.id] = room.scoreByPlayerId[player.id] ?? 0;

    socketToRoom.set(socket.id, code);
    socket.data.playerId = player.id;
    socket.join(code);

    socket.emit("phone:join-success", {
      roomCode: code,
      playerName: player.name,
      playerId: player.id,
      sector,
      hubs: hubs.filter((hub) => hub.sector === sector)
    });

    emitPlayers(room);
    emitRoomState(room);
  });

  socket.on(
    "phone:launch",
    ({
      roomCode,
      originCode,
      destinationCode,
      targetSector,
      color
    }: {
      roomCode: string;
      originCode: string;
      destinationCode?: string;
      targetSector?: SectorName;
      color?: string;
    }) => {
      const code = String(roomCode || "").toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== "live") {
        return;
      }

      const origin = hubs.find((hub) => hub.code === originCode);
      if (!origin) {
        return;
      }

      let destination = destinationCode ? hubs.find((hub) => hub.code === destinationCode) : undefined;
      if (!destination) {
        const chosenSector =
          targetSector && sectorNeighbors[origin.sector].includes(targetSector)
            ? targetSector
            : sectorNeighbors[origin.sector][0];
        destination = pickTargetHub(origin, chosenSector);
      }

      const pilotId = socket.data.playerId as string | undefined;
      const pilot = pilotId ? room.players.get(pilotId) : undefined;
      if (!pilot) {
        return;
      }

      const durationMs = 2000 + Math.floor(Math.random() * 900);
      const points = pointsForLaunch(origin, destination);

      room.scoreByPlayerId[pilot.id] = (room.scoreByPlayerId[pilot.id] ?? 0) + points;
      emitPlayers(room);
      emitRoomState(room);

      const launch = {
        id: nanoid(10),
        origin,
        destination,
        color: color || "#36c8ff",
        fromSector: origin.sector,
        toSector: destination.sector,
        launchedBy: pilot.name,
        launchedAt: Date.now(),
        durationMs,
        points
      };

      io.to(room.code).emit("flight:launch", launch);

      setTimeout(() => {
        io.to(room.code).emit("flight:complete", { id: launch.id });

        const nextPlayer = pickPlayerInSector(room, destination.sector);
        if (nextPlayer) {
          io.to(nextPlayer.socketId).emit("phone:inbound", {
            id: nanoid(8),
            hub: destination,
            color: launch.color,
            fromSector: launch.fromSector,
            expiresAt: Date.now() + 5000
          });
        }
      }, durationMs);
    }
  );

  socket.on("disconnect", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) {
      return;
    }

    if (room.tvSocketId === socket.id) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      io.to(room.code).emit("phone:error", { message: "Host disconnected. Room closed." });
      rooms.delete(room.code);
      socketToRoom.delete(socket.id);
      return;
    }

    const playerId = socket.data.playerId as string | undefined;
    if (playerId) {
      room.players.delete(playerId);
      delete room.scoreByPlayerId[playerId];
      emitPlayers(room);
      emitRoomState(room);
    }

    socketToRoom.delete(socket.id);
  });
});

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`CloudHopper server listening on :${port}`);
});
