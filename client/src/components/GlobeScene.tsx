import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html } from "@react-three/drei";
import { Color, Group, Mesh, Vector3 } from "three";
import { FlightEvent, Hub } from "../types";

function latLngToVec3(lat: number, lng: number, radius = 2.05) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function FlightTrail({ flight }: { flight: FlightEvent }) {
  const markerRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const start = useMemo(
    () => latLngToVec3(flight.origin.lat, flight.origin.lng),
    [flight.origin.lat, flight.origin.lng]
  );
  const end = useMemo(
    () => latLngToVec3(flight.destination.lat, flight.destination.lng),
    [flight.destination.lat, flight.destination.lng]
  );

  const apex = useMemo(() => {
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize();
    return mid.multiplyScalar(2.75);
  }, [end, start]);

  const samples = useMemo(() => {
    const points: Vector3[] = [];
    for (let i = 0; i <= 48; i += 1) {
      const t = i / 48;
      const a = start.clone().multiplyScalar((1 - t) * (1 - t));
      const b = apex.clone().multiplyScalar(2 * (1 - t) * t);
      const c = end.clone().multiplyScalar(t * t);
      points.push(a.add(b).add(c));
    }
    return points;
  }, [apex, end, start]);

  useFrame((state) => {
    const progress = Math.min(Math.max((Date.now() - flight.launchedAt) / flight.durationMs, 0), 1);
    const index = Math.floor(progress * (samples.length - 1));
    const marker = samples[index] ?? end;

    if (markerRef.current) {
      markerRef.current.position.copy(marker);
      markerRef.current.scale.setScalar(0.94 + Math.sin(state.clock.elapsedTime * 16) * 0.08);
    }

    if (haloRef.current) {
      haloRef.current.position.copy(marker);
      haloRef.current.scale.setScalar(1.6 + Math.sin(state.clock.elapsedTime * 12) * 0.35);
      const mat = haloRef.current.material;
      if ("opacity" in mat) {
        mat.opacity = 0.16 + Math.sin(state.clock.elapsedTime * 8) * 0.08;
      }
    }

    if (labelRef.current) {
      labelRef.current.style.opacity = String(Math.max(0, 1 - progress));
    }
  });

  return (
    <group>
      <Line points={samples} color={flight.color} lineWidth={2.8} transparent opacity={0.72} />
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.072, 16, 16]} />
        <meshBasicMaterial color={flight.color} transparent opacity={0.18} />
      </mesh>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.048, 16, 16]} />
        <meshStandardMaterial color={flight.color} emissive={new Color(flight.color)} emissiveIntensity={0.8} />
      </mesh>
      <Html position={start.clone().lerp(apex, 0.6)} center>
        <div ref={labelRef} className="score-pop">+{flight.points}</div>
      </Html>
    </group>
  );
}

function HubMarkers({ hubs }: { hubs: Hub[] }) {
  return (
    <group>
      {hubs.map((hub) => {
        const point = latLngToVec3(hub.lat, hub.lng, 2.04);
        return (
          <mesh key={hub.code} position={point}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color="#f8fff2" />
          </mesh>
        );
      })}
    </group>
  );
}

function GlobeVisual({ flights, hubs }: { flights: FlightEvent[]; hubs: Hub[] }) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.055;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial color="#9cd1ff" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.03, 64, 64]} />
        <meshStandardMaterial color="#ebfff2" transparent opacity={0.09} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.12, 64, 64]} />
        <meshBasicMaterial color="#d9efff" transparent opacity={0.05} />
      </mesh>
      <HubMarkers hubs={hubs} />
      {flights.map((flight) => (
        <FlightTrail key={flight.id} flight={flight} />
      ))}
    </group>
  );
}

export function GlobeScene({
  flights,
  roomCode,
  hubs
}: {
  flights: FlightEvent[];
  roomCode: string;
  hubs: Hub[];
}) {
  return (
    <Canvas camera={{ position: [0, 1.7, 5.3], fov: 46 }}>
      <color attach="background" args={["#f9fff4"]} />
      <ambientLight intensity={0.84} />
      <directionalLight position={[6, 6, 5]} intensity={1.15} />
      <pointLight position={[-4, 1, -3]} intensity={0.5} color="#ffd7b5" />
      <Stars radius={48} depth={50} count={1900} factor={4} saturation={0.18} fade speed={0.45} />
      <GlobeVisual flights={flights} hubs={hubs} />
      <Html position={[0, 2.95, 0]} center>
        <div className="orbital-code">{roomCode || "----"}</div>
      </Html>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={1.08} maxPolarAngle={2.04} />
    </Canvas>
  );
}
