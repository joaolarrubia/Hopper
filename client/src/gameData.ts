import { Hub, SectorName } from "./types";

export const sectorOrder: SectorName[] = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania"
];

export const sectorNeighbors: Record<SectorName, SectorName[]> = {
  "North America": ["Europe", "South America", "Asia"],
  "South America": ["North America", "Africa"],
  Europe: ["North America", "Africa", "Asia"],
  Africa: ["Europe", "South America", "Asia"],
  Asia: ["Europe", "Africa", "Oceania", "North America"],
  Oceania: ["Asia"]
};

export const hubs: Hub[] = [
  { code: "NYC", city: "New York", sector: "North America", lat: 40.7128, lng: -74.006, x: 24, y: 44 },
  { code: "MEX", city: "Mexico City", sector: "North America", lat: 19.4326, lng: -99.1332, x: 16, y: 68 },
  { code: "TOR", city: "Toronto", sector: "North America", lat: 43.6532, lng: -79.3832, x: 36, y: 35 },
  { code: "RIO", city: "Rio", sector: "South America", lat: -22.9068, lng: -43.1729, x: 42, y: 64 },
  { code: "BOG", city: "Bogota", sector: "South America", lat: 4.711, lng: -74.0721, x: 24, y: 32 },
  { code: "SCL", city: "Santiago", sector: "South America", lat: -33.4489, lng: -70.6693, x: 28, y: 82 },
  { code: "LON", city: "London", sector: "Europe", lat: 51.5074, lng: -0.1278, x: 18, y: 22 },
  { code: "PAR", city: "Paris", sector: "Europe", lat: 48.8566, lng: 2.3522, x: 34, y: 28 },
  { code: "BER", city: "Berlin", sector: "Europe", lat: 52.52, lng: 13.405, x: 58, y: 24 },
  { code: "CAI", city: "Cairo", sector: "Africa", lat: 30.0444, lng: 31.2357, x: 52, y: 24 },
  { code: "LOS", city: "Lagos", sector: "Africa", lat: 6.5244, lng: 3.3792, x: 32, y: 52 },
  { code: "NBO", city: "Nairobi", sector: "Africa", lat: -1.2921, lng: 36.8219, x: 68, y: 58 },
  { code: "DXB", city: "Dubai", sector: "Asia", lat: 25.2048, lng: 55.2708, x: 24, y: 36 },
  { code: "DEL", city: "Delhi", sector: "Asia", lat: 28.6139, lng: 77.209, x: 44, y: 42 },
  { code: "TYO", city: "Tokyo", sector: "Asia", lat: 35.6762, lng: 139.6503, x: 82, y: 30 },
  { code: "SYD", city: "Sydney", sector: "Oceania", lat: -33.8688, lng: 151.2093, x: 76, y: 66 },
  { code: "AKL", city: "Auckland", sector: "Oceania", lat: -36.8509, lng: 174.7645, x: 88, y: 78 },
  { code: "MEL", city: "Melbourne", sector: "Oceania", lat: -37.8136, lng: 144.9631, x: 62, y: 74 }
];

export function getHubsBySector(sector: SectorName): Hub[] {
  return hubs.filter((hub) => hub.sector === sector);
}
