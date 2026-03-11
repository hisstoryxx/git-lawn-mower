"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { HeatmapDay } from "@/lib/types";

function toKSTTime(dateStr: string): string {
  const utc = new Date(dateStr);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours().toString().padStart(2, "0");
  const m = kst.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getColor(count: number, maxCount: number): string {
  if (count === 0) return "#1e293b";
  const ratio = count / maxCount;
  if (ratio < 0.25) return "#22c55e";
  if (ratio < 0.5) return "#4ade80";
  if (ratio < 0.75) return "#86efac";
  return "#bbf7d0";
}

function getGameColor(count: number, maxCount: number): string {
  if (count === 0) return "#1a1a2e";
  const ratio = count / maxCount;
  if (ratio < 0.25) return "#22c55e";
  if (ratio < 0.5) return "#4ade80";
  if (ratio < 0.75) return "#86efac";
  return "#bbf7d0";
}

function getEmissiveIntensity(count: number, maxCount: number): number {
  if (count === 0) return 0;
  return (count / maxCount) * 0.4 + 0.15;
}

// ─── Debris Particle ───

interface Particle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: string;
  scale: number;
  life: number;
}

function DebrisParticles({ particles }: { particles: Particle[] }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const mesh = meshRefs.current[i];
      if (!mesh || p.life <= 0) continue;

      p.velocity.y -= 15 * delta; // gravity
      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.life -= delta;
      p.scale = Math.max(0, p.life * 0.8);

      mesh.position.copy(p.position);
      mesh.scale.setScalar(p.scale);
      mesh.rotation.x += delta * 8;
      mesh.rotation.z += delta * 6;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, p.life);
    }
  });

  return (
    <>
      {particles.map((p, i) => (
        <mesh
          key={p.id}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={p.position.clone()}
        >
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshStandardMaterial
            color={p.color}
            emissive={p.color}
            emissiveIntensity={0.8}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </>
  );
}

// ─── Building ───

interface BuildingProps {
  position: [number, number, number];
  height: number;
  color: string;
  gameColor: string;
  emissiveIntensity: number;
  day: HeatmapDay;
  onHover: (day: HeatmapDay | null) => void;
  onClick: (day: HeatmapDay) => void;
  mowed: boolean;
  selected: boolean;
  isGameMode: boolean;
}

function Building({
  position, height, color, gameColor, emissiveIntensity,
  day, onHover, onClick, mowed, selected, isGameMode,
}: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetScaleXZ = hovered || selected ? 1.1 : 1;
    const targetScaleY = mowed ? 0 : 1;
    meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScaleXZ, delta * 8);
    meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, targetScaleXZ, delta * 8);
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScaleY, delta * (mowed ? 12 : 6));
  });

  const actualHeight = Math.max(height, 0.05);
  const activeColor = isGameMode ? gameColor : color;
  const displayColor = mowed ? "#3a2a15" : activeColor;
  const isHighlighted = (hovered || selected) && !mowed;

  return (
    <mesh
      ref={meshRef}
      position={[position[0], actualHeight / 2, position[2]]}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(day);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (day.count > 0) onClick(day);
      }}
    >
      <boxGeometry args={[0.85, actualHeight, 0.85]} />
      <meshStandardMaterial
        color={isHighlighted ? (selected ? "#58a6ff" : "#ffffff") : displayColor}
        emissive={selected ? "#58a6ff" : displayColor}
        emissiveIntensity={
          mowed ? 0.02
          : isGameMode ? (day.count > 0 ? 0.6 : 0)
          : isHighlighted ? emissiveIntensity + 0.3
          : emissiveIntensity
        }
        metalness={isGameMode ? 0.1 : 0.3}
        roughness={isGameMode ? 0.4 : 0.7}
      />
    </mesh>
  );
}

// ─── Ground ───

function Ground({ width, depth, isGameMode }: { width: number; depth: number; isGameMode: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.05, depth / 2]}>
      <planeGeometry args={[width + 4, depth + 4]} />
      <meshStandardMaterial
        color={isGameMode ? "#1a1205" : "#0d1117"}
        metalness={0.5}
        roughness={0.8}
      />
    </mesh>
  );
}

// ─── Labels ───

function MonthLabels({ heatmap }: { heatmap: HeatmapDay[] }) {
  const months = useMemo(() => {
    const seen = new Map<string, number>();
    for (const day of heatmap) {
      const month = day.date.substring(0, 7);
      if (!seen.has(month)) {
        seen.set(month, day.week);
      }
    }
    const labels: { month: string; week: number }[] = [];
    seen.forEach((week, month) => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIdx = parseInt(month.split("-")[1], 10) - 1;
      labels.push({ month: monthNames[monthIdx], week });
    });
    return labels;
  }, [heatmap]);

  return (
    <>
      {months.map((m) => (
        <Text
          key={m.month + m.week}
          position={[m.week * 1.1 + 0.5, 0, -1.2]}
          fontSize={0.6}
          color="#8b949e"
          anchorX="center"
        >
          {m.month}
        </Text>
      ))}
    </>
  );
}

function DayLabels() {
  const days = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
  return (
    <>
      {days.map(
        (label, i) =>
          label && (
            <Text
              key={label}
              position={[-1.5, 0, i * 1.1 + 0.5]}
              fontSize={0.5}
              color="#8b949e"
              anchorX="center"
            >
              {label}
            </Text>
          )
      )}
    </>
  );
}

// ─── Lawn Mower (game mode) ───

interface LawnMowerProps {
  gridWidth: number;
  gridDepth: number;
  onMow: (week: number, dayOfWeek: number) => void;
}

function LawnMower({ gridWidth, gridDepth, onMow }: LawnMowerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bladeRef = useRef<THREE.Mesh>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const posRef = useRef({ x: -2, z: 3.5 });
  const velRef = useRef({ x: 0, z: 0 }); // velocity for momentum
  const rotRef = useRef(0);
  const tiltRef = useRef({ x: 0, z: 0 }); // body tilt for visual feedback
  const { camera } = useThree();

  const ACCEL = 40;
  const MAX_SPEED = 28;
  const FRICTION = 0.94;
  const TURN_SPEED = 4;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent page scroll with arrow keys
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      keysRef.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const clampDelta = Math.min(delta, 0.05); // prevent huge jumps

    // Turning
    const turnLeft = keys.has("arrowleft") || keys.has("a");
    const turnRight = keys.has("arrowright") || keys.has("d");
    if (turnLeft) rotRef.current += TURN_SPEED * clampDelta;
    if (turnRight) rotRef.current -= TURN_SPEED * clampDelta;

    // Acceleration (arrow keys: up/down for forward/back)
    const forward = keys.has("arrowup") || keys.has("w");
    const backward = keys.has("arrowdown") || keys.has("s");

    if (forward) {
      velRef.current.x += Math.sin(rotRef.current) * ACCEL * clampDelta;
      velRef.current.z += Math.cos(rotRef.current) * ACCEL * clampDelta;
    }
    if (backward) {
      velRef.current.x -= Math.sin(rotRef.current) * ACCEL * 0.5 * clampDelta;
      velRef.current.z -= Math.cos(rotRef.current) * ACCEL * 0.5 * clampDelta;
    }

    // Apply friction (momentum decay)
    velRef.current.x *= FRICTION;
    velRef.current.z *= FRICTION;

    // Clamp speed
    const speed = Math.sqrt(velRef.current.x ** 2 + velRef.current.z ** 2);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      velRef.current.x *= scale;
      velRef.current.z *= scale;
    }

    // Update position
    posRef.current.x += velRef.current.x * clampDelta;
    posRef.current.z += velRef.current.z * clampDelta;

    // Bounce off boundaries
    if (posRef.current.x < -3) { posRef.current.x = -3; velRef.current.x *= -0.3; }
    if (posRef.current.x > gridWidth + 2) { posRef.current.x = gridWidth + 2; velRef.current.x *= -0.3; }
    if (posRef.current.z < -3) { posRef.current.z = -3; velRef.current.z *= -0.3; }
    if (posRef.current.z > gridDepth + 2) { posRef.current.z = gridDepth + 2; velRef.current.z *= -0.3; }

    // Body tilt based on acceleration (visual only)
    const targetTiltX = -velRef.current.z * 0.02;
    const targetTiltZ = velRef.current.x * 0.02;
    tiltRef.current.x = THREE.MathUtils.lerp(tiltRef.current.x, targetTiltX, clampDelta * 5);
    tiltRef.current.z = THREE.MathUtils.lerp(tiltRef.current.z, targetTiltZ, clampDelta * 5);

    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, 0.3, posRef.current.z);
      groupRef.current.rotation.y = rotRef.current;
      groupRef.current.rotation.x = tiltRef.current.x;
      groupRef.current.rotation.z = tiltRef.current.z;
    }

    // Spin blade faster when moving
    if (bladeRef.current) {
      bladeRef.current.rotation.z += clampDelta * (15 + speed * 3);
    }

    // Chase camera: behind the mower, looking forward in travel direction
    const camDist = 8 + speed * 0.15;
    const camHeight = 5 + speed * 0.08;
    const camOffset = new THREE.Vector3(
      posRef.current.x - Math.sin(rotRef.current) * camDist,
      camHeight,
      posRef.current.z - Math.cos(rotRef.current) * camDist
    );
    camera.position.lerp(camOffset, clampDelta * 3);
    // Look ahead of the mower
    const lookAhead = new THREE.Vector3(
      posRef.current.x + Math.sin(rotRef.current) * 10,
      0.5,
      posRef.current.z + Math.cos(rotRef.current) * 10
    );
    camera.lookAt(lookAhead);

    // Check mowing collision
    const gridX = Math.round(posRef.current.x / 1.1);
    const gridZ = Math.round(posRef.current.z / 1.1);
    if (gridX >= 0 && gridZ >= 0 && gridZ < 7) {
      onMow(gridX, gridZ);
    }
  });

  return (
    <group ref={groupRef} position={[-2, 0.3, 3.5]}>
      {/* Body */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.4, 1.2]} />
        <meshStandardMaterial color="#e74c3c" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.5, -0.7]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.6, 0.08, 0.8]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Wheels */}
      {[[-0.35, 0, 0.4], [0.35, 0, 0.4], [-0.35, 0, -0.4], [0.35, 0, -0.4]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* Spinning blade */}
      <mesh ref={bladeRef} position={[0, -0.05, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.35, 16]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Headlights */}
      <pointLight position={[0, 0.4, 0.7]} intensity={3} distance={6} color="#ffdd88" />
      <spotLight position={[0, 0.5, 0.8]} angle={0.5} penumbra={0.5} intensity={2} distance={10} color="#ffffff" target-position={[0, 0, 5]} />
    </group>
  );
}

// ─── Scenes ───

interface CitySceneProps {
  heatmap: HeatmapDay[];
  onHover: (day: HeatmapDay | null) => void;
  onClick: (day: HeatmapDay) => void;
  selectedDate: string | null;
  mowedSet: Set<string>;
}

function CityScene({ heatmap, onHover, onClick, selectedDate, mowedSet }: CitySceneProps) {
  const maxCount = useMemo(() => Math.max(...heatmap.map((d) => d.count), 1), [heatmap]);
  const maxWeek = useMemo(() => Math.max(...heatmap.map((d) => d.week), 0), [heatmap]);

  const buildings = useMemo(
    () =>
      heatmap.map((day) => ({
        day,
        position: [day.week * 1.1, 0, day.dayOfWeek * 1.1] as [number, number, number],
        height: day.count > 0 ? (day.count / maxCount) * 6 + 0.2 : 0.05,
        color: getColor(day.count, maxCount),
        gameColor: getGameColor(day.count, maxCount),
        emissiveIntensity: getEmissiveIntensity(day.count, maxCount),
      })),
    [heatmap, maxCount]
  );

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 15, 0]} intensity={0.5} color="#58a6ff" />

      <Ground width={(maxWeek + 1) * 1.1} depth={7 * 1.1} isGameMode={false} />
      <MonthLabels heatmap={heatmap} />
      <DayLabels />

      {buildings.map((b) => (
        <Building
          key={b.day.date}
          position={b.position}
          height={b.height}
          color={b.color}
          gameColor={b.gameColor}
          emissiveIntensity={b.emissiveIntensity}
          day={b.day}
          onHover={onHover}
          onClick={onClick}
          selected={b.day.date === selectedDate}
          mowed={mowedSet.has(`${b.day.week}-${b.day.dayOfWeek}`)}
          isGameMode={false}
        />
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={80}
        target={[(maxWeek * 1.1) / 2, 0, 3.5]}
      />
    </>
  );
}

interface GameSceneProps {
  heatmap: HeatmapDay[];
  mowedSet: Set<string>;
  particles: Particle[];
  onMow: (week: number, dayOfWeek: number) => void;
}

function GameScene({ heatmap, mowedSet, particles, onMow }: GameSceneProps) {
  const maxCount = useMemo(() => Math.max(...heatmap.map((d) => d.count), 1), [heatmap]);
  const maxWeek = useMemo(() => Math.max(...heatmap.map((d) => d.week), 0), [heatmap]);

  const buildings = useMemo(
    () =>
      heatmap.map((day) => ({
        day,
        position: [day.week * 1.1, 0, day.dayOfWeek * 1.1] as [number, number, number],
        height: day.count > 0 ? (day.count / maxCount) * 6 + 0.2 : 0.05,
        color: getColor(day.count, maxCount),
        gameColor: getGameColor(day.count, maxCount),
        emissiveIntensity: getEmissiveIntensity(day.count, maxCount),
      })),
    [heatmap, maxCount]
  );

  const noop = useCallback(() => {}, []);
  const noopClick = useCallback(() => {}, []) as (day: HeatmapDay) => void;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 10]} intensity={1} color="#ffffee" />
      <hemisphereLight args={["#87ceeb", "#2d1f0e", 0.4]} />
      <pointLight position={[25, 20, 3.5]} intensity={0.6} color="#39d353" />

      <Ground width={(maxWeek + 1) * 1.1} depth={7 * 1.1} isGameMode={true} />
      <MonthLabels heatmap={heatmap} />

      {buildings.map((b) => (
        <Building
          key={b.day.date}
          position={b.position}
          height={b.height}
          color={b.color}
          gameColor={b.gameColor}
          emissiveIntensity={b.emissiveIntensity}
          day={b.day}
          onHover={noop}
          onClick={noopClick}
          selected={false}
          mowed={mowedSet.has(`${b.day.week}-${b.day.dayOfWeek}`)}
          isGameMode={true}
        />
      ))}

      <DebrisParticles particles={particles} />

      <LawnMower
        gridWidth={(maxWeek + 1) * 1.1}
        gridDepth={7 * 1.1}
        onMow={onMow}
      />
    </>
  );
}

// ─── Main Component ───

interface CommitCityProps {
  heatmap: HeatmapDay[];
}

let particleIdCounter = 0;

export default function CommitCity({ heatmap }: CommitCityProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [gameMode, setGameMode] = useState(false);
  const [mowedSet, setMowedSet] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<Particle[]>([]);

  const maxCount = useMemo(() => Math.max(...heatmap.map((d) => d.count), 1), [heatmap]);

  const totalGrass = useMemo(() => heatmap.filter((d) => d.count > 0).length, [heatmap]);
  const mowedGrass = useMemo(() => {
    let count = 0;
    mowedSet.forEach((key) => {
      const [w, d] = key.split("-").map(Number);
      const day = heatmap.find((h) => h.week === w && h.dayOfWeek === d);
      if (day && day.count > 0) count++;
    });
    return count;
  }, [mowedSet, heatmap]);

  // Clean up dead particles periodically
  useEffect(() => {
    if (particles.length === 0) return;
    const timer = setInterval(() => {
      setParticles((prev) => prev.filter((p) => p.life > 0));
    }, 2000);
    return () => clearInterval(timer);
  }, [particles.length]);

  const spawnDebris = useCallback((wx: number, wz: number, color: string, intensity: number) => {
    const count = Math.min(Math.floor(intensity * 20) + 12, 40);
    const newParticles: Particle[] = [];
    const colors = [color, "#ffff00", "#ff6600", "#44ff44", "#ffffff"];
    for (let i = 0; i < count; i++) {
      const isFirework = Math.random() < 0.3;
      newParticles.push({
        id: particleIdCounter++,
        position: new THREE.Vector3(
          wx * 1.1 + (Math.random() - 0.5) * 0.8,
          Math.random() * 1.5 + 0.3,
          wz * 1.1 + (Math.random() - 0.5) * 0.8
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * (isFirework ? 14 : 8),
          Math.random() * (isFirework ? 18 : 12) + 6,
          (Math.random() - 0.5) * (isFirework ? 14 : 8)
        ),
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: Math.random() * 0.7 + 0.3,
        life: Math.random() * 2 + 1,
      });
    }
    setParticles((prev) => [...prev.slice(-150), ...newParticles]);
  }, []);

  const handleMow = useCallback((week: number, dayOfWeek: number) => {
    const key = `${week}-${dayOfWeek}`;
    setMowedSet((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);

      // Spawn debris for this cell
      const day = heatmap.find((h) => h.week === week && h.dayOfWeek === dayOfWeek);
      if (day && day.count > 0) {
        const color = getGameColor(day.count, maxCount);
        spawnDebris(week, dayOfWeek, color, day.count / maxCount);
      }

      return next;
    });
  }, [heatmap, maxCount, spawnDebris]);

  const toggleGame = () => {
    if (gameMode) {
      setMowedSet(new Set());
      setParticles([]);
    }
    setSelectedDay(null);
    setGameMode(!gameMode);
  };

  const handleBuildingClick = useCallback((day: HeatmapDay) => {
    setSelectedDay((prev) => (prev?.date === day.date ? null : day));
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#0d1117] border border-gray-800">
      <div className={`flex ${selectedDay && !gameMode ? "h-[600px]" : "h-[500px]"}`}>
        {/* 3D Canvas */}
        <div className={`relative ${selectedDay && !gameMode ? "w-[60%]" : "w-full"} h-full transition-all duration-300`}>
          <Canvas
            camera={
              gameMode
                ? { position: [-5, 10, 15], fov: 55, near: 0.1, far: 200 }
                : { position: [25, 20, 25], fov: 50, near: 0.1, far: 200 }
            }
          >
            <fog attach="fog" args={[gameMode ? "#1a1205" : "#0d1117", 30, 80]} />
            {gameMode ? (
              <GameScene heatmap={heatmap} mowedSet={mowedSet} particles={particles} onMow={handleMow} />
            ) : (
              <CityScene
                heatmap={heatmap}
                onHover={setHoveredDay}
                onClick={handleBuildingClick}
                selectedDate={selectedDay?.date || null}
                mowedSet={mowedSet}
              />
            )}
          </Canvas>

          {/* Game mode HUD */}
          {gameMode && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm border border-green-500/30 rounded-lg p-3">
              <div className="text-green-300 font-bold text-lg">
                {mowedGrass}/{totalGrass}
              </div>
              <div className="w-40 h-2.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${totalGrass > 0 ? (mowedGrass / totalGrass) * 100 : 0}%` }}
                />
              </div>
              {mowedGrass === totalGrass && totalGrass > 0 && (
                <div className="text-yellow-300 font-bold text-sm mt-2 animate-pulse">
                  ALL CLEAR!
                </div>
              )}
            </div>
          )}

          {/* Game controls hint */}
          {gameMode && (
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 text-xs text-gray-300">
              <div className="grid grid-cols-3 gap-1 w-24 mb-2">
                <div />
                <div className="bg-green-900/60 border border-green-500/40 rounded text-center py-1.5 text-green-300 font-mono text-base">^</div>
                <div />
                <div className="bg-green-900/60 border border-green-500/40 rounded text-center py-1.5 text-green-300 font-mono text-base">&lt;</div>
                <div className="bg-green-900/60 border border-green-500/40 rounded text-center py-1.5 text-green-300 font-mono text-base">v</div>
                <div className="bg-green-900/60 border border-green-500/40 rounded text-center py-1.5 text-green-300 font-mono text-base">&gt;</div>
              </div>
              Hold to accelerate!
            </div>
          )}

          {/* Hover tooltip (view mode, only when no panel open) */}
          {!gameMode && !selectedDay && hoveredDay && (
            <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 text-sm max-w-xs">
              <div className="font-bold text-white">{hoveredDay.date}</div>
              <div className="text-green-400">
                {hoveredDay.count} commit{hoveredDay.count !== 1 ? "s" : ""}
              </div>
              {hoveredDay.commits.slice(0, 3).map((c, i) => (
                <div key={i} className="text-gray-400 text-xs mt-1 truncate">
                  <span className="text-blue-400">[{c.project}]</span> {c.title}
                </div>
              ))}
              {hoveredDay.commits.length > 3 && (
                <div className="text-gray-500 text-xs mt-1">
                  +{hoveredDay.commits.length - 3} more
                </div>
              )}
            </div>
          )}

          {/* Mode toggle button */}
          <button
            onClick={toggleGame}
            className={`absolute top-4 right-4 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              gameMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {gameMode ? "Exit Game" : "Mow the Lawn!"}
          </button>

          {/* Bottom hint (view mode) */}
          {!gameMode && (
            <div className="absolute bottom-4 right-4 text-xs text-gray-500">
              Click a building to see commits / Drag to rotate
            </div>
          )}
        </div>

        {/* Commit Detail Panel */}
        {selectedDay && !gameMode && (
          <div className="w-[40%] h-full border-l border-gray-800 bg-[#0d1117] flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <div>
                <div className="font-bold text-white">{selectedDay.date}</div>
                <div className="text-green-400 text-sm">
                  {selectedDay.count} commit{selectedDay.count !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable commit list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
              {selectedDay.commits
                .sort((a, b) => b.time.localeCompare(a.time))
                .map((commit, i) => (
                  <div
                    key={i}
                    className="py-2.5 border-b border-gray-800/50 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white break-words leading-snug">
                          {commit.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                            {commit.project}
                          </span>
                          <span className="text-xs text-gray-500">
                            {toKSTTime(commit.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
