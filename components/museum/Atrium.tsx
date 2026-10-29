"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerspectiveCamera, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EXHIBITS } from "@/lib/museum/exhibits";
import { useMuseum } from "@/lib/museum/store";
import type { ExhibitId } from "@/lib/museum/types";

function Door({
  index,
  total,
  accent,
  locked,
  collected,
  onOpen,
}: {
  index: number;
  total: number;
  accent: string;
  locked: boolean;
  collected: boolean;
  onOpen: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 6.2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 0.8 + index) * 0.08;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, -angle + Math.PI, 0]}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          if (!locked) onOpen();
        }}
        onPointerOver={() => {
          document.body.style.cursor = locked ? "not-allowed" : "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[1.1, 2.4, 0.18]} />
        <meshStandardMaterial
          color={locked ? "#1a1220" : "#12141c"}
          emissive={new THREE.Color(accent)}
          emissiveIntensity={locked ? 0.05 : collected ? 0.55 : 0.28}
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 1.5, 0.05]}>
        <boxGeometry args={[0.9, 0.12, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function CentralSculpture({ artifacts }: { artifacts: number }) {
  const group = useRef<THREE.Group>(null);
  const intensity = 0.2 + artifacts * 0.08;
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = clock.elapsedTime * 0.15;
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.2) * 0.15;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
      <group ref={group} position={[0, 2.2, 0]}>
        <mesh>
          <icosahedronGeometry args={[1.1, 1]} />
          <meshStandardMaterial
            color="#0b0d14"
            emissive="#5eead4"
            emissiveIntensity={intensity}
            wireframe
          />
        </mesh>
        <mesh scale={0.62}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#e879f9"
            emissive="#e879f9"
            emissiveIntensity={intensity * 0.7}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>
    </Float>
  );
}

function ImpossibleStairs() {
  const steps = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.4;
  });
  return (
    <group ref={g} position={[0, 0.2, 0]}>
      {steps.map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 0.55) * (2.2 + i * 0.08),
            i * 0.22,
            Math.sin(i * 0.55) * (2.2 + i * 0.08),
          ]}
          rotation={[0, i * 0.55, 0.15]}
        >
          <boxGeometry args={[1.4, 0.08, 0.55]} />
          <meshStandardMaterial color="#161822" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Pillars() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 9, 3, Math.sin(a) * 9]}>
            <cylinderGeometry args={[0.28, 0.38, 7, 8]} />
            <meshStandardMaterial color="#0e1018" metalness={0.5} roughness={0.55} />
          </mesh>
        );
      })}
    </>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[12, 64]} />
      <meshStandardMaterial
        color="#07080f"
        metalness={0.85}
        roughness={0.25}
        emissive="#12202a"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function Scene() {
  const enterExhibit = useMuseum((s) => s.enterExhibit);
  const artifacts = useMuseum((s) => s.artifacts);
  const canForbidden = useMuseum((s) => s.canEnterForbidden);
  const setCurator = useMuseum((s) => s.setCuratorMessage);
  const unlock = useMuseum((s) => s.unlockAchievement);
  const quality = useMuseum((s) => s.quality);

  const starCount = quality === "low" ? 400 : quality === "medium" ? 900 : 1600;

  return (
    <>
      <color attach="background" args={["#030308"]} />
      <fog attach="fog" args={["#030308", 8, 28]} />
      <PerspectiveCamera makeDefault position={[0, 4.5, 11]} fov={48} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 6, 0]} intensity={1.4} color="#5eead4" />
      <pointLight position={[6, 3, -4]} intensity={0.7} color="#e879f9" />
      <pointLight position={[-5, 2, 5]} intensity={0.5} color="#d4b483" />
      <Stars radius={60} depth={40} count={starCount} factor={3} saturation={0} fade speed={0.4} />
      <Floor />
      <Pillars />
      <ImpossibleStairs />
      <CentralSculpture artifacts={artifacts.length} />
      <mesh
        position={[0, 0.05, 0]}
        onClick={(e) => {
          e.stopPropagation();
          const n = ((useMuseum.getState().flags.sculptureClicks as number) || 0) + 1;
          useMuseum.getState().setFlag("sculptureClicks", n);
          if (n >= 3) {
            setCurator("The sculpture acknowledges a triple knock. Something under the floor shifts.");
            unlock("konami_void");
          }
        }}
      >
        <cylinderGeometry args={[1.6, 1.6, 0.08, 32]} />
        <meshStandardMaterial color="#10121a" emissive="#5eead4" emissiveIntensity={0.12} />
      </mesh>
      {EXHIBITS.map((ex, i) => (
        <Door
          key={ex.id}
          index={i}
          total={EXHIBITS.length}
          accent={ex.accent}
          locked={ex.id === "forbidden" && !canForbidden()}
          collected={artifacts.includes(ex.artifactId)}
          onOpen={() => enterExhibit(ex.id as ExhibitId)}
        />
      ))}
    </>
  );
}

export default function Atrium() {
  const quality = useMuseum((s) => s.quality);
  const dpr: [number, number] =
    quality === "low" ? [1, 1] : quality === "high" ? [1, 2] : [1, 1.5];

  return (
    <div className="im-canvas-wrap" aria-label="Museum atrium">
      <Canvas dpr={dpr} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
        <Scene />
      </Canvas>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "5.8rem",
          transform: "translateX(-50%)",
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(243,239,230,0.55)",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        Tap a luminous door · or open the directory
      </div>
    </div>
  );
}
