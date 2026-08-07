import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html } from "@react-three/drei";
import { Color, Group, Vector3 } from "three";
import { FlightEvent } from "../types";

function latLngToVec3(lat: number, lng: number, radius = 2.05) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function FlightTrail({ flight, now }: { flight: FlightEvent; now: number }) {
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
    return mid.multiplyScalar(2.6);
  }, [end, start]);

  const samples = useMemo(() => {
    const points: Vector3[] = [];
    for (let i = 0; i <= 36; i += 1) {
      const t = i / 36;
      const a = start.clone().multiplyScalar((1 - t) * (1 - t));
      const b = apex.clone().multiplyScalar(2 * (1 - t) * t);
      const c = end.clone().multiplyScalar(t * t);
      points.push(a.add(b).add(c));
    }
    return points;
  }, [apex, end, start]);

  const progress = Math.min(Math.max((now - flight.launchedAt) / flight.durationMs, 0), 1);
  const index = Math.floor(progress * (samples.length - 1));
  const marker = samples[index] ?? end;

  return (
    <group>
      <Line points={samples} color={flight.color} lineWidth={2.2} transparent opacity={0.75} />
      <mesh position={marker}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color={flight.color} emissive={new Color(flight.color)} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function GlobeVisual({ flights }: { flights: FlightEvent[] }) {
  const groupRef = useRef<Group>(null);
  const clockRef = useRef(0);

  useFrame((state, delta) => {
    clockRef.current += delta * 1000;
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.06;
    }
  });

  const now = Date.now() + clockRef.current * 0;

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial color="#a4d9ff" roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.03, 64, 64]} />
        <meshStandardMaterial color="#f4fbff" transparent opacity={0.08} />
      </mesh>
      {flights.map((flight) => (
        <FlightTrail key={flight.id} flight={flight} now={now} />
      ))}
    </group>
  );
}

export function GlobeScene({ flights, roomCode }: { flights: FlightEvent[]; roomCode: string }) {
  return (
    <Canvas camera={{ position: [0, 1.6, 5.2], fov: 48 }}>
      <color attach="background" args={["#f6fff8"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 4, 6]} intensity={1.1} />
      <Stars radius={42} depth={48} count={1900} factor={4} saturation={0.2} fade speed={0.5} />
      <GlobeVisual flights={flights} />
      <Html position={[0, 2.9, 0]} center>
        <div className="orbital-code">{roomCode || "----"}</div>
      </Html>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={2.0} />
    </Canvas>
  );
}
