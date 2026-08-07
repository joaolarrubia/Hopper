import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { customAlphabet, nanoid } from "nanoid";
import { Server } from "socket.io";
import { hubs, sectorNeighbors, sectors } from "./data";
import { Hub, Mission, MissionKind, Player, Room, RoomPhase, SectorName } from "./types";

const ROUND_DURATION_MS = 95_000;
const MISSION_DURATION_MS = 28_000;
const MISSION_TICK_MS = 9_000;
const MAX_ACTIVE_MISSIONS = 3;
const PLAYER_LAUNCH_COOLDOWN_MS = 320;

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

function randomItem<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function getRoomBySocket(socketId: string) {
  const roomCode = socketToRoom.get(socketId);
  if (!roomCode) {
    return null;
  }
  return rooms.get(roomCode) ?? null;
}

function removeSocketPlayerMembership(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) {
    socketToRoom.delete(socketId);
    return;
  }

  let removedPlayerId: string | null = null;
  for (const player of room.players.values()) {
    if (player.socketId === socketId) {
      removedPlayerId = player.id;
      break;
    }
  }

  if (removedPlayerId) {
    room.players.delete(removedPlayerId);
    delete room.scoreByPlayerId[removedPlayerId];
    delete room.launchCooldownByPlayerId[removedPlayerId];
    emitPlayers(room);
    emitRoomState(room);
  }

  socketToRoom.delete(socketId);
}

function closeRoom(code: string) {
  const room = rooms.get(code);
  if (!room) {
    return;
  }

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
  }
  stopMissionLoop(room);
  io.to(code).emit("phone:error", { message: "Host disconnected. Room closed." });

  socketToRoom.delete(room.tvSocketId);
  for (const player of room.players.values()) {
    socketToRoom.delete(player.socketId);
  }

  rooms.delete(code);
}

function pickTargetHub(origin: Hub, targetSector?: SectorName): Hub {
  if (!targetSector) {
    const sameSector = hubs.filter((hub) => hub.sector === origin.sector && hub.code !== origin.code);
    return randomItem(sameSector.length > 0 ? sameSector : [origin]);
  }

  const targets = hubs.filter((hub) => hub.sector === targetSector);
  return randomItem(targets.length > 0 ? targets : [origin]);
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

function emitMissions(room: Room) {
  io.to(room.code).emit("room:missions", {
    missions: room.missions
  });
}

function expireMissions(room: Room) {
  const now = Date.now();
  room.missions = room.missions.filter((mission) => mission.expiresAt > now);
}

function createMission(room: Room): Mission {
  const kinds: MissionKind[] = ["sector", "hub", "longhaul"];
  const kind = randomItem(kinds);

  if (kind === "sector") {
    const targetSector = randomItem(sectors);
    return {
      id: nanoid(9),
      kind,
      title: `Priority Lift: ${targetSector}`,
      description: `Land any flight in ${targetSector}.`,
      reward: 25,
      expiresAt: Date.now() + MISSION_DURATION_MS,
      targetSector
    };
  }

  if (kind === "hub") {
    const hub = randomItem(hubs);
    return {
      id: nanoid(9),
      kind,
      title: `Direct Service: ${hub.code}`,
      description: `Route a flight into ${hub.city}.`,
      reward: 34,
      expiresAt: Date.now() + MISSION_DURATION_MS,
      targetHubCode: hub.code
    };
  }

  return {
    id: nanoid(9),
    kind,
    title: "Long Haul Rush",
    description: "Complete a high-distance route worth 20+ base points.",
    reward: 30,
    expiresAt: Date.now() + MISSION_DURATION_MS
  };
}

function topUpMissions(room: Room) {
  expireMissions(room);
  while (room.missions.length < MAX_ACTIVE_MISSIONS) {
    room.missions.push(createMission(room));
  }
  emitMissions(room);
}

function stopMissionLoop(room: Room) {
  if (room.missionTimer) {
    clearInterval(room.missionTimer);
    room.missionTimer = null;
  }
}

function startMissionLoop(room: Room) {
  stopMissionLoop(room);
  topUpMissions(room);
  room.missionTimer = setInterval(() => {
    if (room.phase !== "live") {
      return;
    }
    topUpMissions(room);
  }, MISSION_TICK_MS);
}

function setPhase(room: Room, phase: RoomPhase) {
  room.phase = phase;
  emitRoomState(room);
}

function endRound(room: Room) {
  room.roundEndsAt = null;
  room.roundTimer = null;
  stopMissionLoop(room);
  room.missions = [];
  emitMissions(room);
  setPhase(room, "ended");
}

function startRound(room: Room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  room.round += 1;
  room.roundEndsAt = Date.now() + ROUND_DURATION_MS;
  room.missions = [];
  setPhase(room, "live");
  startMissionLoop(room);

  room.roundTimer = setTimeout(() => {
    endRound(room);
  }, ROUND_DURATION_MS);
}

function isMissionCompleted(mission: Mission, origin: Hub, destination: Hub, basePoints: number): boolean {
  if (mission.kind === "sector") {
    return destination.sector === mission.targetSector;
  }

  if (mission.kind === "hub") {
    return destination.code === mission.targetHubCode;
  }

  return origin.sector !== destination.sector && basePoints >= 20;
}

io.on("connection", (socket) => {
  socket.on("tv:create-room", () => {
    const existing = getRoomBySocket(socket.id);
    if (existing && existing.tvSocketId === socket.id) {
      closeRoom(existing.code);
    }

    const code = makeRoomCode();
    const room: Room = {
      code,
      tvSocketId: socket.id,
      players: new Map(),
      phase: "lobby",
      round: 0,
      roundEndsAt: null,
      scoreByPlayerId: {},
      roundTimer: null,
      missionTimer: null,
      missions: [],
      launchCooldownByPlayerId: {}
    };

    rooms.set(code, room);
    socketToRoom.set(socket.id, code);
    socket.join(code);

    socket.emit("room:created", { code });
    emitRoomState(room);
    emitMissions(room);
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
    stopMissionLoop(room);

    room.phase = "lobby";
    room.round = 0;
    room.roundEndsAt = null;
    room.scoreByPlayerId = {};
    room.missions = [];
    room.launchCooldownByPlayerId = {};
    for (const player of room.players.values()) {
      room.scoreByPlayerId[player.id] = 0;
    }

    emitPlayers(room);
    emitRoomState(room);
    emitMissions(room);
  });

  socket.on("phone:join-room", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    removeSocketPlayerMembership(socket.id);

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
    emitMissions(room);
  });

  socket.on(
    "phone:launch",
    (
      {
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
      },
      ack?: (response: {
        ok: boolean;
        message: string;
        pointsAwarded?: number;
        totalScore?: number;
        missionBonus?: number;
      }) => void
    ) => {
      const code = String(roomCode || "").toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== "live") {
        ack?.({ ok: false, message: "Round is not live." });
        return;
      }

      const pilotId = socket.data.playerId as string | undefined;
      const pilot = pilotId ? room.players.get(pilotId) : undefined;
      if (!pilot) {
        ack?.({ ok: false, message: "Pilot not found in room." });
        return;
      }

      const now = Date.now();
      const lastLaunch = room.launchCooldownByPlayerId[pilot.id] ?? 0;
      if (now - lastLaunch < PLAYER_LAUNCH_COOLDOWN_MS) {
        ack?.({ ok: false, message: "Too fast. Wait a moment before next launch." });
        return;
      }

      const origin = hubs.find((hub) => hub.code === originCode);
      if (!origin) {
        ack?.({ ok: false, message: "Origin hub not found." });
        return;
      }

      if (origin.sector !== pilot.sector) {
        ack?.({ ok: false, message: "You can only launch from your assigned sector." });
        return;
      }

      let destination = destinationCode ? hubs.find((hub) => hub.code === destinationCode) : undefined;

      if (destination && destination.sector !== origin.sector && !sectorNeighbors[origin.sector].includes(destination.sector)) {
        ack?.({ ok: false, message: "Target hub must be local or in a neighboring sector." });
        return;
      }

      if (!destination) {
        const chosenSector =
          targetSector && sectorNeighbors[origin.sector].includes(targetSector)
            ? targetSector
            : sectorNeighbors[origin.sector][0];
        destination = pickTargetHub(origin, chosenSector);
      }

      room.launchCooldownByPlayerId[pilot.id] = now;

      const durationMs = 2000 + Math.floor(Math.random() * 900);
      const basePoints = pointsForLaunch(origin, destination);

      let missionBonus = 0;
      const completed = room.missions.filter((mission) => isMissionCompleted(mission, origin, destination, basePoints));
      if (completed.length > 0) {
        missionBonus = completed.reduce((sum, mission) => sum + mission.reward, 0);
        room.missions = room.missions.filter((mission) => !completed.some((done) => done.id === mission.id));
      }

      const points = basePoints + missionBonus;
      room.scoreByPlayerId[pilot.id] = (room.scoreByPlayerId[pilot.id] ?? 0) + points;
      emitPlayers(room);
      emitRoomState(room);
      emitMissions(room);

      if (completed.length > 0) {
        for (const mission of completed) {
          io.to(room.code).emit("mission:completed", {
            mission,
            completedBy: pilot.name,
            reward: mission.reward
          });
        }
      }

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

      ack?.({
        ok: true,
        message: missionBonus > 0 ? `Mission bonus +${missionBonus}` : `Route complete +${points}`,
        pointsAwarded: points,
        totalScore: room.scoreByPlayerId[pilot.id],
        missionBonus
      });
    }
  );

  socket.on("disconnect", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) {
      return;
    }

    if (room.tvSocketId === socket.id) {
      closeRoom(room.code);
      return;
    }

    removeSocketPlayerMembership(socket.id);
  });
});

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Hopper server listening on :${port}`);
});
