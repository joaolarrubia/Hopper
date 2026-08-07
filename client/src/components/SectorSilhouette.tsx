import { SectorName } from "../types";

const sectorPaths: Record<SectorName, string> = {
  "North America": "M9 22 L14 16 L24 12 L34 13 L43 18 L48 24 L44 29 L40 29 L37 35 L31 38 L26 36 L20 34 L14 30 L10 26 Z",
  "South America": "M48 30 L54 34 L58 42 L57 50 L54 56 L56 63 L53 73 L48 82 L44 80 L42 71 L43 64 L40 56 L42 48 L44 40 Z",
  Europe: "M44 20 L50 18 L56 20 L60 24 L57 28 L51 29 L46 27 L42 24 Z",
  Africa: "M50 31 L56 34 L59 40 L58 49 L55 58 L51 66 L46 65 L44 57 L45 48 L47 40 Z",
  Asia: "M58 22 L66 20 L76 24 L84 30 L86 36 L81 40 L74 39 L68 36 L63 33 L57 29 Z",
  Oceania: "M76 58 L82 61 L87 66 L84 72 L78 73 L73 69 L74 63 Z"
};

export function SectorSilhouette({ sector }: { sector: SectorName }) {
  return (
    <svg className="map-silhouette" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <path d={sectorPaths[sector]} />
      <path d="M6 20 L94 20" className="lat-line" />
      <path d="M6 40 L94 40" className="lat-line" />
      <path d="M6 60 L94 60" className="lat-line" />
      <path d="M6 80 L94 80" className="lat-line" />
      <path d="M20 8 L20 92" className="lng-line" />
      <path d="M40 8 L40 92" className="lng-line" />
      <path d="M60 8 L60 92" className="lng-line" />
      <path d="M80 8 L80 92" className="lng-line" />
    </svg>
  );
}
