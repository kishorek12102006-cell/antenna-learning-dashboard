"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import type { InfillPattern } from "@/lib/print";

function ImportedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} position={[0, 0.25, 0]} />;
}

function Beam({ from, to, height, thickness, color, opacity = 0.88 }: {
  from: [number, number, number];
  to: [number, number, number];
  height: number;
  thickness: number;
  color: string;
  opacity?: number;
}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  return <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[0, angle, 0]}>
    <boxGeometry args={[thickness, height, length]} />
    <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.58} />
  </mesh>;
}

function Infill({ pattern, density, width, length, centerY, height }: {
  pattern: InfillPattern;
  density: number;
  width: number;
  length: number;
  centerY: number;
  height: number;
}) {
  if (pattern === "empty" || density <= 0) return null;
  const innerWidth = width * 0.88;
  const innerLength = length * 0.88;
  const cells = Math.max(2, Math.min(6, Math.round(2 + density / 25)));
  const rib = 0.025 + (density / 100) * 0.035;
  const color = "#88a9a4";

  if (pattern === "solid") return <mesh position={[0, centerY, 0]}>
    <boxGeometry args={[innerWidth, height * 0.9, innerLength]} />
    <meshStandardMaterial color={color} transparent opacity={0.26} roughness={0.8} />
  </mesh>;

  if (pattern === "grid" || pattern === "lines" || pattern === "waffle") {
    const ribs = [];
    for (let i = 1; i <= cells; i += 1) {
      const z = -innerLength / 2 + (innerLength * i) / (cells + 1);
      ribs.push(<mesh key={`x-${i}`} position={[0, centerY, z]}>
        <boxGeometry args={[innerWidth, height * 0.9, rib]} />
        <meshStandardMaterial color={color} transparent opacity={0.86} roughness={0.58} />
      </mesh>);
      if (pattern !== "lines") {
        const x = -innerWidth / 2 + (innerWidth * i) / (cells + 1);
        ribs.push(<mesh key={`z-${i}`} position={[x, centerY, 0]}>
          <boxGeometry args={[rib, height * 0.9, innerLength]} />
          <meshStandardMaterial color={color} transparent opacity={0.86} roughness={0.58} />
        </mesh>);
      }
    }
    if (pattern === "waffle") {
      for (let row = 0; row < cells; row += 1) {
        for (let col = 0; col < cells; col += 1) {
          const x1 = -innerWidth / 2 + (innerWidth * (col + 0.15)) / cells;
          const x2 = -innerWidth / 2 + (innerWidth * (col + 0.85)) / cells;
          const z1 = -innerLength / 2 + (innerLength * (row + 0.15)) / cells;
          const z2 = -innerLength / 2 + (innerLength * (row + 0.85)) / cells;
          ribs.push(<Beam key={`d-${row}-${col}`} from={[x1, centerY, z1]} to={[x2, centerY, z2]} height={height * 0.72} thickness={rib * 0.65} color={color} opacity={0.68} />);
        }
      }
    }
    return <group>{ribs}</group>;
  }

  if (pattern === "honeycomb") {
    const rows = cells;
    const cols = cells;
    const cellWidth = innerWidth / (cols + 0.5);
    const cellLength = innerLength / (rows + 0.3);
    const radius = Math.min(cellWidth * 0.47, cellLength * 0.48);
    const edges: ReactNode[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cx = -innerWidth / 2 + cellWidth * (col + 0.5 + (row % 2) * 0.5);
        const cz = -innerLength / 2 + cellLength * (row + 0.5);
        for (let edge = 0; edge < 6; edge += 1) {
          const a = (Math.PI / 3) * edge;
          const b = (Math.PI / 3) * ((edge + 1) % 6);
          const ax = cx + radius * Math.cos(a);
          const az = cz + radius * Math.sin(a);
          const bx = cx + radius * Math.cos(b);
          const bz = cz + radius * Math.sin(b);
          if (Math.abs(ax) > innerWidth / 2 || Math.abs(bx) > innerWidth / 2 || Math.abs(az) > innerLength / 2 || Math.abs(bz) > innerLength / 2) continue;
          edges.push(<Beam key={`hex-${row}-${col}-${edge}`} from={[ax, centerY, az]} to={[bx, centerY, bz]} height={height * 0.9} thickness={rib} color={color} />);
        }
      }
    }
    return <group>{edges}</group>;
  }

  if (pattern === "gyroid") {
    const ribs: ReactNode[] = [];
    const segments = 18;
    const amplitude = (innerWidth / (cells + 1)) * 0.34;
    for (let lane = 0; lane <= cells; lane += 1) {
      const baseX = -innerWidth / 2 + (innerWidth * (lane + 0.5)) / (cells + 1);
      for (let part = 0; part < segments; part += 1) {
        const z1 = -innerLength / 2 + (innerLength * part) / segments;
        const z2 = -innerLength / 2 + (innerLength * (part + 1)) / segments;
        const phase = (lane % 2) * Math.PI;
        const x1 = baseX + amplitude * Math.sin((part / segments) * Math.PI * 2 * 2 + phase);
        const x2 = baseX + amplitude * Math.sin(((part + 1) / segments) * Math.PI * 2 * 2 + phase);
        ribs.push(<Beam key={`wave-${lane}-${part}`} from={[x1, centerY, z1]} to={[x2, centerY, z2]} height={height * 0.88} thickness={rib * 0.8} color={color} opacity={0.8} />);
      }
    }
    return <group>{ribs}</group>;
  }

  if (pattern === "concentric") {
    const rings: ReactNode[] = [];
    const ringCount = Math.max(1, Math.round(cells / 2));
    for (let ring = 0; ring < ringCount; ring += 1) {
      const scale = 1 - ring / (ringCount + 0.2);
      const halfW = (innerWidth * scale) / 2;
      const halfL = (innerLength * scale) / 2;
      const points: [number, number, number][] = [
        [-halfW, centerY, -halfL], [halfW, centerY, -halfL], [halfW, centerY, halfL], [-halfW, centerY, halfL], [-halfW, centerY, -halfL],
      ];
      for (let edge = 0; edge < 4; edge += 1) rings.push(<Beam key={`ring-${ring}-${edge}`} from={points[edge]} to={points[edge + 1]} height={height * 0.88} thickness={rib} color={color} />);
    }
    return <group>{rings}</group>;
  }

  return null;
}

function PatchModel({ width, length, boardWidth, boardLength, thickness, pattern, density, cutaway }: {
  width: number;
  length: number;
  boardWidth: number;
  boardLength: number;
  thickness: number;
  pattern: InfillPattern;
  density: number;
  cutaway: boolean;
}) {
  // Board dimensions are in cm. Vertical thickness is exaggerated for visibility;
  // length and width remain proportional to the calculated design.
  const w = width / 10;
  const l = length / 10;
  const bw = boardWidth / 10;
  const bl = boardLength / 10;
  const h = thickness / 10;
  const shownH = Math.max(h * 2.8, 0.24);
  const skin = Math.min(0.075, shownH * 0.18);
  const coreH = shownH - skin * 2;
  const edge = Math.max(0.045, Math.min(0.09, Math.min(bw, bl) * 0.025));
  const metalT = 0.025;
  const topY = shownH / 2 + metalT / 2;
  const inset = Math.min(l * 0.14, 0.36);
  const notchWidth = Math.max(0.16, Math.min(0.25, w * 0.13));
  const sideWidth = (w - notchWidth) / 2;
  const entryZ = -bl / 2 + 0.12;
  const notchEndZ = -l / 2 + inset;
  const feedLength = Math.max(0.08, notchEndZ - entryZ);

  return <group>
    {cutaway ? <group>
      <mesh position={[0, shownH / 2 - skin / 2, 0]}>
        <boxGeometry args={[bw - edge * 2, skin, bl - edge * 2]} />
        <meshStandardMaterial color="#90b4ad" transparent opacity={0.14} depthWrite={false} roughness={0.85} />
      </mesh>
      <mesh position={[0, -shownH / 2 + skin / 2, 0]}>
        <boxGeometry args={[bw - edge * 2, skin, bl - edge * 2]} />
        <meshStandardMaterial color="#668780" transparent opacity={0.21} depthWrite={false} roughness={0.85} />
      </mesh>
      {[-1, 1].flatMap((side) => [
        <mesh key={`rail-x-${side}`} position={[side * (bw / 2 - edge / 2), 0, 0]}>
          <boxGeometry args={[edge, shownH, bl]} />
          <meshStandardMaterial color="#647c78" roughness={0.82} />
        </mesh>,
        <mesh key={`rail-z-${side}`} position={[0, 0, side * (bl / 2 - edge / 2)]}>
          <boxGeometry args={[bw - edge * 2, shownH, edge]} />
          <meshStandardMaterial color="#647c78" roughness={0.82} />
        </mesh>,
      ])}
      <Infill pattern={pattern} density={density} width={bw - edge * 2} length={bl - edge * 2} centerY={0} height={coreH} />
    </group> : <mesh position={[0, 0, 0]}>
      <boxGeometry args={[bw, shownH, bl]} />
      <meshStandardMaterial color="#78958f" roughness={0.74} />
    </mesh>}

    <mesh position={[0, -shownH / 2 - metalT / 2, 0]}>
      <boxGeometry args={[bw, metalT, bl]} />
      <meshStandardMaterial color="#8b99a1" metalness={0.82} roughness={0.28} />
    </mesh>

    {/* A notched copper patch and center feed make the 50-ohm feed concept visible. */}
    <mesh position={[-(w + notchWidth) / 4, topY, 0]}>
      <boxGeometry args={[sideWidth, metalT, l]} />
      <meshStandardMaterial color="#d99b46" metalness={0.86} roughness={0.24} />
    </mesh>
    <mesh position={[(w + notchWidth) / 4, topY, 0]}>
      <boxGeometry args={[sideWidth, metalT, l]} />
      <meshStandardMaterial color="#d99b46" metalness={0.86} roughness={0.24} />
    </mesh>
    <mesh position={[0, topY, -l / 2 + inset + metalT / 2]}>
      <boxGeometry args={[w, metalT, metalT]} />
      <meshStandardMaterial color="#d99b46" metalness={0.86} roughness={0.24} />
    </mesh>
    <mesh position={[0, topY, entryZ + feedLength / 2]}>
      <boxGeometry args={[notchWidth * 0.82, metalT, feedLength]} />
      <meshStandardMaterial color="#edbd68" metalness={0.84} roughness={0.25} />
    </mesh>

    {/* Small coax connector and center pin at the board edge. */}
    <mesh position={[0, -shownH / 2 - 0.11, entryZ]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.095, 0.095, 0.22, 20]} />
      <meshStandardMaterial color="#aab4b8" metalness={0.9} roughness={0.24} />
    </mesh>
    <mesh position={[0, -shownH / 2 + 0.005, entryZ]}>
      <cylinderGeometry args={[0.025, 0.025, shownH + 0.06, 12]} />
      <meshStandardMaterial color="#e8b467" metalness={0.9} roughness={0.2} />
    </mesh>
  </group>;
}

export default function AntennaViewer({ width, length, boardWidth, boardLength, thickness, modelUrl, pattern, density }: {
  width: number;
  length: number;
  boardWidth: number;
  boardLength: number;
  thickness: number;
  modelUrl: string;
  pattern: InfillPattern;
  density: number;
}) {
  const [cutaway, setCutaway] = useState(true);
  return <>
    <div className="viewer">
      <div className="viewer-tag"><span className="live-dot" /> 3D DESIGN VIEW</div>
      {!modelUrl && <button className="viewer-toggle" type="button" onClick={() => setCutaway((value) => !value)} aria-pressed={cutaway}>
        {cutaway ? "CUTAWAY ON" : "CUTAWAY OFF"}
      </button>}
      <Canvas camera={{ position: [6.4, 4.7, 6.4], fov: 36 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#111820"]} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 8, 5]} intensity={2.5} castShadow />
        <directionalLight position={[-5, 2, -3]} intensity={0.6} color="#8ba89d" />
        <Environment preset="city" />
        <Suspense fallback={null}>
          {modelUrl
            ? <ImportedModel url={modelUrl} />
            : <PatchModel width={width} length={length} boardWidth={boardWidth} boardLength={boardLength} thickness={thickness} pattern={pattern} density={density} cutaway={cutaway} />}
        </Suspense>
        <Grid position={[0, -0.54, 0]} args={[16, 16]} cellSize={0.5} cellThickness={0.5}
          sectionSize={2} sectionThickness={1} fadeDistance={18} infiniteGrid
          cellColor="#293640" sectionColor="#43515b" />
        <OrbitControls makeDefault enableDamping minDistance={2.4} maxDistance={18} />
      </Canvas>
      <div className="viewer-hint">Drag to orbit <span>·</span> Scroll to zoom</div>
      <div className="model-note">{modelUrl ? "Fusion model" : "Cutaway thickness exaggerated for visibility"}</div>
    </div>
    {!modelUrl && <div className="model-legend" aria-label="Antenna model parts">
      <span><i className="legend-copper"/>Patch + feed</span>
      <span><i className="legend-substrate"/>Printed dielectric + infill</span>
      <span><i className="legend-ground"/>Ground plane</span>
      <small>Illustrative geometry · not to scale vertically</small>
    </div>}
  </>;
}

