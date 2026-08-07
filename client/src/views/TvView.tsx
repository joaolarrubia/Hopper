import { useEffect, useMemo, useState } from "react";
import { GlobeScene } from "../components/GlobeScene";
import { socket } from "../socket";
import { FlightEvent, SectorName } from "../types";

interface PlayerSnapshot {
  id: string;
  name: string;
  sector: SectorName;
}

export function TvView() {
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<PlayerSnapshot[]>([]);
  const [flights, setFlights] = useState<FlightEvent[]>([]);

  useEffect(() => {
    socket.connect();
    socket.emit("tv:create-room");

    socket.on("room:created", ({ code }: { code: string }) => {
      setRoomCode(code);
    });

    socket.on("room:players", ({ players: currentPlayers }: { players: PlayerSnapshot[] }) => {
      setPlayers(currentPlayers);
    });

    socket.on("flight:launch", (flight: FlightEvent) => {
      setFlights((existing) => [...existing, flight]);
    });

    socket.on("flight:complete", ({ id }: { id: string }) => {
      setFlights((existing) => existing.filter((flight) => flight.id !== id));
    });

    const interval = window.setInterval(() => {
      const now = Date.now();
      setFlights((existing) => existing.filter((flight) => now - flight.launchedAt < flight.durationMs + 200));
    }, 120);

    return () => {
      window.clearInterval(interval);
      socket.off("room:created");
      socket.off("room:players");
      socket.off("flight:launch");
      socket.off("flight:complete");
      socket.disconnect();
    };
  }, []);

  const heading = useMemo(() => (roomCode ? `cloudhopper.tv/${roomCode}` : "Starting room..."), [roomCode]);

  return (
    <main className="tv-shell">
      <div className="tv-hud">
        <h1>CloudHopper</h1>
        <p>{heading}</p>
        <div className="tv-chip-grid">
          {players.length === 0 ? <span className="chip">Waiting for players</span> : null}
          {players.map((player) => (
            <span key={player.id} className="chip">
              {player.name} - {player.sector}
            </span>
          ))}
        </div>
      </div>
      <section className="tv-canvas-wrap">
        <GlobeScene flights={flights} roomCode={roomCode} />
      </section>
    </main>
  );
}
