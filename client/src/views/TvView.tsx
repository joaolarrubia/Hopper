import { useEffect, useMemo, useState } from "react";
import { GlobeScene } from "../components/GlobeScene";
import { hubs } from "../gameData";
import { socket } from "../socket";
import { FlightEvent, PlayerSnapshot, RoomState } from "../types";

function formatMs(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TvView() {
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<PlayerSnapshot[]>([]);
  const [flights, setFlights] = useState<FlightEvent[]>([]);
  const [state, setState] = useState<RoomState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    socket.connect();
    socket.emit("tv:create-room");

    socket.on("room:created", ({ code }: { code: string }) => {
      setRoomCode(code);
    });

    socket.on("room:state", (nextState: RoomState) => {
      setState(nextState);
      setRoomCode(nextState.code);
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
      setNow(Date.now());
      setFlights((existing) => {
        const timestamp = Date.now();
        return existing.filter((flight) => timestamp - flight.launchedAt < flight.durationMs + 280);
      });
    }, 100);

    return () => {
      window.clearInterval(interval);
      socket.off("room:created");
      socket.off("room:state");
      socket.off("room:players");
      socket.off("flight:launch");
      socket.off("flight:complete");
      socket.disconnect();
    };
  }, []);

  const heading = useMemo(() => (roomCode ? `cloudhopper.tv/${roomCode}` : "Creating room..."), [roomCode]);

  const remaining = useMemo(() => {
    if (!state?.roundEndsAt) {
      return "01:35";
    }
    return formatMs(state.roundEndsAt - now);
  }, [now, state?.roundEndsAt]);

  const canStart = (state?.phase === "lobby" || state?.phase === "ended") && players.length > 0;

  return (
    <main className="tv-shell deluxe">
      <div className="tv-hud deluxe">
        <div className="hud-left">
          <p className="eyebrow">Global Theater</p>
          <h1>CloudHopper</h1>
          <p>{heading}</p>
        </div>

        <div className="hud-center">
          <div className="timer-pill">{remaining}</div>
          <small>
            {state?.phase === "live" ? `Round ${state.round}` : state?.phase === "ended" ? "Round Complete" : "Lobby"}
          </small>
        </div>

        <div className="hud-right">
          <button
            type="button"
            className="tv-action"
            disabled={!canStart || !roomCode}
            onClick={() => socket.emit("tv:start-round", { roomCode })}
          >
            {state?.phase === "ended" ? "Start Next Round" : "Start Round"}
          </button>
          <button
            type="button"
            className="tv-action ghost"
            disabled={!roomCode}
            onClick={() => socket.emit("tv:reset-room", { roomCode })}
          >
            Reset
          </button>
        </div>
      </div>

      <section className="tv-canvas-wrap">
        <GlobeScene flights={flights} roomCode={roomCode} hubs={hubs} />

        <aside className="leaderboard-panel">
          <h2>Leaderboard</h2>
          <ul>
            {(state?.leaderboard ?? []).slice(0, 6).map((entry, index) => (
              <li key={entry.playerId}>
                <span>
                  {index + 1}. {entry.playerName}
                </span>
                <strong>{entry.score}</strong>
              </li>
            ))}
            {(state?.leaderboard.length ?? 0) === 0 ? <li>Waiting for pilots...</li> : null}
          </ul>
        </aside>

        <aside className="activity-panel">
          <h2>Live Flights</h2>
          <ul>
            {flights.slice(-6).reverse().map((flight) => (
              <li key={flight.id}>
                <span>
                  {flight.origin.code} to {flight.destination.code}
                </span>
                <strong>+{flight.points}</strong>
              </li>
            ))}
            {flights.length === 0 ? <li>No flights in airspace</li> : null}
          </ul>
        </aside>
      </section>
    </main>
  );
}
