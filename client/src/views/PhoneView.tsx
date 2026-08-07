import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getHubsBySector, sectorNeighbors } from "../gameData";
import { socket } from "../socket";
import { Hub, InboundDot, JoinSuccess } from "../types";

function pickColor() {
  const colors = ["#ff7f6b", "#36c8ff", "#8de969", "#ffd966", "#f196ff"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function PhoneView() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState<JoinSuccess | null>(null);
  const [dragStart, setDragStart] = useState<Hub | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [inboundDots, setInboundDots] = useState<InboundDot[]>([]);
  const [message, setMessage] = useState("Connect to a room to start routing flights.");

  const hubs = useMemo(() => (joined ? getHubsBySector(joined.sector) : []), [joined]);

  useEffect(() => {
    socket.connect();

    socket.on("phone:join-success", (payload: JoinSuccess) => {
      setJoined(payload);
      setMessage(`Sector assigned: ${payload.sector}`);
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    });

    socket.on("phone:error", ({ message: text }: { message: string }) => {
      setMessage(text);
    });

    socket.on("phone:inbound", (dot: InboundDot) => {
      setInboundDots((existing) => [...existing, dot]);
      setMessage(`${dot.hub.city} incoming from ${dot.fromSector}! Relay in 5 seconds.`);
      if (navigator.vibrate) {
        navigator.vibrate([18, 20, 18]);
      }
    });

    const timer = window.setInterval(() => {
      const now = Date.now();
      setInboundDots((existing) => existing.filter((dot) => dot.expiresAt > now));
    }, 120);

    return () => {
      window.clearInterval(timer);
      socket.off("phone:join-success");
      socket.off("phone:error");
      socket.off("phone:inbound");
      socket.disconnect();
    };
  }, []);

  function joinRoom() {
    socket.emit("phone:join-room", {
      roomCode: code.trim().toUpperCase(),
      playerName: name.trim() || "Pilot"
    });
  }

  function startDrag(hub: Hub) {
    setDragStart(hub);
    setDragPoint({ x: hub.x, y: hub.y });
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
      return Math.hypot(dx, dy) < 9;
    });

    const color = pickColor();

    if (nearby) {
      socket.emit("phone:launch", {
        roomCode: joined.roomCode,
        originCode: dragStart.code,
        destinationCode: nearby.code,
        color
      });
      setMessage(`${dragStart.city} to ${nearby.city}`);
      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } else {
      const atEdge =
        dragPoint.x < 8 || dragPoint.x > 92 || dragPoint.y < 8 || dragPoint.y > 92;
      if (atEdge) {
        const neighbors = sectorNeighbors[joined.sector];
        const targetSector = neighbors[Math.floor(Math.random() * neighbors.length)];
        socket.emit("phone:launch", {
          roomCode: joined.roomCode,
          originCode: dragStart.code,
          targetSector,
          color
        });
        setMessage(`Pass-off to ${targetSector}`);
        if (navigator.vibrate) {
          navigator.vibrate([8, 20, 8]);
        }
      }
    }

    setDragStart(null);
    setDragPoint(null);
  }

  if (!joined) {
    return (
      <main className="phone-shell">
        <motion.section
          className="phone-card"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <h1>CloudHopper</h1>
          <p>Enter the 4-letter room code from the big screen.</p>
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

  return (
    <main className="phone-shell">
      <section className="phone-topbar">
        <div>
          <strong>{joined.playerName}</strong>
          <span>{joined.sector}</span>
        </div>
        <span className="room-pill">{joined.roomCode}</span>
      </section>

      <section
        className="sector-map"
        onPointerMove={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          if (dragStart) {
            setDragPoint({ x, y });
          }
        }}
        onPointerUp={endDrag}
      >
        {hubs.map((hub) => (
          <motion.button
            key={hub.code}
            className="hub-node"
            style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
            onPointerDown={() => startDrag(hub)}
            whileTap={{ scale: 1.12 }}
            type="button"
          >
            <span>{hub.code}</span>
            <small>{hub.city}</small>
          </motion.button>
        ))}

        {inboundDots.map((dot) => {
          const remaining = Math.max(0, dot.expiresAt - Date.now());
          return (
            <motion.div
              key={dot.id}
              className="inbound-dot"
              style={{ left: `${dot.hub.x}%`, top: `${dot.hub.y}%`, background: dot.color }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.8, 1.15, 1], opacity: 1 }}
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
              ) - 10} ${dragPoint.x} ${dragPoint.y}`}
              stroke="#36c8ff"
              strokeWidth="1.3"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
          </svg>
        ) : null}
      </section>

      <section className="phone-bottom">
        <p>{message}</p>
      </section>
    </main>
  );
}
