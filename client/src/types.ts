export type SectorName =
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Asia"
  | "Oceania";

export interface Hub {
  code: string;
  city: string;
  sector: SectorName;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface FlightEvent {
  id: string;
  origin: Hub;
  destination: Hub;
  color: string;
  fromSector: SectorName;
  toSector: SectorName;
  launchedBy: string;
  launchedAt: number;
  durationMs: number;
  points: number;
}

export type RoomPhase = "lobby" | "live" | "ended";

export interface PlayerSnapshot {
  id: string;
  name: string;
  sector: SectorName;
  score: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  sector: SectorName;
  score: number;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  round: number;
  roundEndsAt: number | null;
  playerCount: number;
  leaderboard: LeaderboardEntry[];
}

export interface InboundDot {
  id: string;
  hub: Hub;
  color: string;
  fromSector: SectorName;
  expiresAt: number;
}

export interface JoinSuccess {
  roomCode: string;
  playerName: string;
  playerId: string;
  sector: SectorName;
  hubs: Hub[];
}
