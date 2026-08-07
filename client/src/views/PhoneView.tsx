import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getHubsBySector, sectorNeighbors } from "../gameData";
import { socket } from "../socket";
import { Hub, InboundDot, JoinSuccess, LaunchAck, Mission, RoomState, SectorName } from "../types";
import { SectorSilhouette } from "../components/SectorSilhouette";

function pickColor() {
  const colors = ["#ff7f6b", "#36c8ff", "#8de969", "#ffd966", "#f196ff", "#ffaf47"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function formatMs(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function edgeTargetSector(sector: SectorName, x: number, y: number): SectorName {
  const neighbors = sectorNeighbors[sector];
  if (neighbors.length === 1) {
    return neighbors[0];
  }

  if (x < 18) {
    return neighbors[0];
  }
  if (x > 82) {
    return neighbors[Math.min(1, neighbors.length - 1)];
  }
  if (y < 18) {
    return neighbors[Math.min(2, neighbors.length - 1)];
  }
  return neighbors[Math.min(3, neighbors.length - 1)] ?? neighbors[0];
}

export function PhoneView() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState<JoinSuccess | null>(null);
  const [dragStart, setDragStart] = useState<Hub | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [inboundDots, setInboundDots] = useState<InboundDot[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [message, setMessage] = useState("Connect to a room to begin your sector.");
  const [now, setNow] = useState(Date.now());

  const hubs = useMemo(() => (joined ? getHubsBySector(joined.sector) : []), [joined]);

  const myScore = useMemo(() => {
    if (!joined || !roomState) {
      return 0;
    }
    return roomState.leaderboard.find((entry) => entry.playerId === joined.playerId)?.score ?? 0;
  }, [joined, roomState]);

  useEffect(() => {
    socket.connect();

    socket.on("phone:join-success", (payload: JoinSuccess) => {
      setJoined(payload);
      setMessage(`Sector assigned: ${payload.sector}. Await host start.`);
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    });

    socket.on("room:state", (state: RoomState) => {
      setRoomState(state);
    });

    socket.on("room:missions", ({ missions: nextMissions }: { missions: Mission[] }) => {
      setMissions(nextMissions);
    });

    socket.on("phone:error", ({ message: text }: { message: string }) => {
      setMessage(text);
    });

    socket.on("phone:inbound", (dot: InboundDot) => {
      setInboundDots((existing) => [...existing, dot]);
      setMessage(`${dot.hub.city} incoming from ${dot.fromSector}. Relay now.`);
      if (navigator.vibrate) {
        navigator.vibrate([18, 24, 18]);
      }
    });

    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      setInboundDots((existing) => existing.filter((dot) => dot.expiresAt > timestamp));
      setMissions((existing) => existing.filter((mission) => mission.expiresAt > timestamp));
    }, 120);

    return () => {
      window.clearInterval(timer);
      socket.off("phone:join-success");
      socket.off("room:state");
      socket.off("room:missions");
      socket.off("phone:error");
      socket.off("phone:inbound");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!roomState) {
      return;
    }

    if (roomState.phase === "live") {
      setMessage(`Round ${roomState.round} is live. Route flights now.`);
      return;
    }

    if (roomState.phase === "ended") {
      setMessage("Round complete. Await the next launch window.");
      return;
    }

    setMessage("Lobby open. Wait for host to start the round.");
  }, [roomState?.phase, roomState?.round]);

  function joinRoom() {
    socket.emit("phone:join-room", {
      roomCode: code.trim().toUpperCase(),
      playerName: name.trim() || "Pilot"
    });
  }

  function startDrag(hub: Hub) {
    if (roomState?.phase !== "live") {
      setMessage("Round is paused. Wait for host to start.");
      return;
    }
    setDragStart(hub);
    setDragPoint({ x: hub.x, y: hub.y });
  }

  function launchWithAck(payload: {
    roomCode: string;
    originCode: string;
    destinationCode?: string;
    targetSector?: SectorName;
    color: string;
  }) {
    socket.emit("phone:launch", payload, (ack: LaunchAck) => {
      setMessage(ack.message);
      if (!ack.ok && navigator.vibrate) {
        navigator.vibrate([18, 10, 18]);
      }
      if (ack.ok && navigator.vibrate) {
        navigator.vibrate(14);
      }
    });
  }

  function endDrag() {
    if (!dragStart || !dragPoint || !joined) {
      setDragStart(null);
      setDragPoint(null);
      return;
    }

    const nearby = hubs.find((hub) => {
      if (hub.code === dragStart.code) {
        return false;
      }
      const dx = dragPoint.x - hub.x;
      const dy = dragPoint.y - hub.y;
      return Math.hypot(dx, dy) < 10;
    });

    const color = pickColor();

    if (nearby) {
      launchWithAck({
        roomCode: joined.roomCode,
        originCode: dragStart.code,
        destinationCode: nearby.code,
        color
      });
    } else {
      const atEdge = dragPoint.x < 10 || dragPoint.x > 90 || dragPoint.y < 10 || dragPoint.y > 90;
      if (atEdge) {
        const targetSector = edgeTargetSector(joined.sector, dragPoint.x, dragPoint.y);
        launchWithAck({
          roomCode: joined.roomCode,
          originCode: dragStart.code,
          targetSector,
          color
        });
      } else {
        setMessage("Route canceled. Drag to a hub or the border for pass-off.");
      }
    }

    setDragStart(null);
    setDragPoint(null);
  }

  if (!joined) {
    return (
      <main className="phone-shell prejoin">
        <motion.section
          className="phone-card deluxe"
          initial={{ y: 22, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <p className="eyebrow">Sector Launchpad</p>
          <h1>Join Hopper</h1>
          <p>Enter the 4-letter room code from the big screen and choose your pilot name.</p>
          <input
            maxLength={4}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="PLAY"
          />
          <input
            maxLength={16}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pilot name"
          />
          <button type="button" onClick={joinRoom}>
            Join Flight Deck
          </button>
          <small>{message}</small>
        </motion.section>
      </main>
    );
  }

  const roundClock = roomState?.roundEndsAt ? formatMs(roomState.roundEndsAt - now) : "01:35";
  const mapClass = joined.sector.toLowerCase().replace(/\s+/g, "-");

  return (
    <main className="phone-shell live">
      <section className="phone-topbar deluxe">
        <div>
          <strong>{joined.playerName}</strong>
          <span>{joined.sector}</span>
        </div>
        <div className="phone-right-stats">
          <span className="room-pill">{joined.roomCode}</span>
          <span className="score-pill">{myScore} pts</span>
        </div>
      </section>

      <section className="phase-strip">
        <strong>{roomState?.phase === "live" ? `Round ${roomState.round}` : "Lobby"}</strong>
        <span>{roundClock}</span>
      </section>

      <section className="phone-mission-strip">
        {missions.map((mission) => (
          <article key={mission.id} className="phone-mission-card">
            <strong>{mission.title}</strong>
            <p>{mission.description}</p>
            <span>
              +{mission.reward} / {formatMs(mission.expiresAt - now)}
            </span>
          </article>
        ))}
        {missions.length === 0 ? <p className="empty-missions">Missions loading...</p> : null}
      </section>

      <section
        className={`sector-map ${mapClass}`}
        onPointerMove={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          if (dragStart) {
            setDragPoint({ x, y });
          }
        }}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <SectorSilhouette sector={joined.sector} />

        {hubs.map((hub) => (
          <motion.button
            key={hub.code}
            className="hub-node"
            style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
            onPointerDown={() => startDrag(hub)}
            whileTap={{ scale: 1.14 }}
            type="button"
          >
            <span>{hub.code}</span>
            <small>{hub.city}</small>
          </motion.button>
        ))}

        {inboundDots.map((dot) => {
          const remaining = Math.max(0, dot.expiresAt - now);
          return (
            <motion.div
              key={dot.id}
              className="inbound-dot"
              style={{ left: `${dot.hub.x}%`, top: `${dot.hub.y}%`, background: dot.color }}
              initial={{ scale: 0.45, opacity: 0 }}
              animate={{ scale: [0.75, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              <em>{Math.ceil(remaining / 1000)}s</em>
            </motion.div>
          );
        })}

        {dragStart && dragPoint ? (
          <svg className="drag-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              d={`M ${dragStart.x} ${dragStart.y} Q ${(dragStart.x + dragPoint.x) / 2} ${Math.min(
                dragStart.y,
                dragPoint.y
              ) - 9} ${dragPoint.x} ${dragPoint.y}`}
              stroke="#2ec3ff"
              strokeWidth="1.5"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
          </svg>
        ) : null}
      </section>

      <section className="phone-bottom deluxe">
        <p>{message}</p>
      </section>
    </main>
  );
}
