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

export interface Room {
  code: string;
  tvSocketId: string;
  players: Map<string, Player>;
}
