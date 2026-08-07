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

export interface Player {
  id: string;
  name: string;
  sector: SectorName;
  socketId: string;
}

export type RoomPhase = "lobby" | "live" | "ended";

export type MissionKind = "sector" | "hub" | "longhaul";

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  reward: number;
  expiresAt: number;
  targetSector?: SectorName;
  targetHubCode?: string;
}

export interface Room {
  code: string;
  tvSocketId: string;
  players: Map<string, Player>;
  phase: RoomPhase;
  round: number;
  roundEndsAt: number | null;
  scoreByPlayerId: Record<string, number>;
  roundTimer: NodeJS.Timeout | null;
  missionTimer: NodeJS.Timeout | null;
  missions: Mission[];
  launchCooldownByPlayerId: Record<string, number>;
}
