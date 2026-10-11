"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function ImportedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} position={[0, 0.25, 0]} />;
}

function PatchModel({ width, length, thickness }: { width: number; length: number; thickness: number }) {
  // Scene units are centimeters; the patch proportions follow the live calculated dimensions.
  const w = width / 10;
  const l = length / 10;
  const h = thickness / 10;
  return <group>
    <mesh position={[0, -h / 2, 0]}>
      <boxGeometry args={[w + 0.6, h, l + 0.6]} />
      <meshStandardMaterial color="#45515b" metalness={0.18} roughness={0.68} />
    </mesh>
    <mesh position={[0, h / 2 + 0.014, 0]}>
      <boxGeometry args={[w, 0.028, l]} />
      <meshStandardMaterial color="#d99b46" metalness={0.82} roughness={0.26} />
    </mesh>
    <mesh position={[0, -h / 2 - 0.014, 0]}>
      <boxGeometry args={[w + 0.6, 0.028, l + 0.6]} />
      <meshStandardMaterial color="#b77932" metalness={0.8} roughness={0.3} />
    </mesh>
    <mesh position={[0, h / 2 + 0.04, -l / 2 - 0.45]}>
      <boxGeometry args={[0.22, 0.028, 0.9]} />
      <meshStandardMaterial color="#e9b65e" metalness={0.75} roughness={0.3} />
    </mesh>
  </group>;
}

export default function AntennaViewer({ width, length, thickness, modelUrl }: {
  width: number; length: number; thickness: number; modelUrl: string;
}) {
  return <div className="viewer">
    <div className="viewer-tag"><span className="live-dot" /> 3D DESIGN VIEW</div>
    <Canvas camera={{ position: [7, 5, 7], fov: 38 }} dpr={[1, 1.75]}>
      <color attach="background" args={["#111820"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 8, 5]} intensity={2.4} />
      <Environment preset="city" />
      <Suspense fallback={null}>
        {modelUrl ? <ImportedModel url={modelUrl} /> : <PatchModel width={width} length={length} thickness={thickness} />}
      </Suspense>
      <Grid position={[0, -0.34, 0]} args={[16, 16]} cellSize={0.5} cellThickness={0.5}
        sectionSize={2} sectionThickness={1} fadeDistance={18} infiniteGrid
        cellColor="#293640" sectionColor="#43515b" />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={18} />
    </Canvas>
    <div className="viewer-hint">Drag to orbit <span>·</span> Scroll to zoom</div>
    {!modelUrl && <div className="model-note">Live parametric preview</div>}
  </div>;
}

