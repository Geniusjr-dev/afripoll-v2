"use client";
import { useEffect, useRef, useState } from "react";

// Self-contained 3D chart (column, pie, scatter) using Three.js.
// Loads three dynamically so it never enters the server bundle.
// Interactions: drag to rotate, scroll to zoom, button to save PNG.

export type Chart3DKind = "column" | "pie" | "scatter";
export interface Chart3DData {
  labels: string[];
  values: number[];               // for column & pie
  points?: { x: number; y: number; z: number }[]; // for scatter
}

const PALETTE = [0x0b4da2, 0x8dc63f, 0x2f8fd6, 0xf2a900, 0xd7263d, 0x6a4c93, 0x1b998b, 0xe07a5f];

export default function Chart3D({ kind, data, title }: { kind: Chart3DKind; data: Chart3DData; title?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState("");
  const rot = useRef({ x: -0.5, y: 0.6 });
  const drag = useRef({ on: false, px: 0, py: 0 });
  const dist = useRef(9);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const THREE = await import("three");
        if (disposed || !mountRef.current) return;
        const mount = mountRef.current;
        const width = mount.clientWidth || 600, height = 360;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.innerHTML = "";
        mount.appendChild(renderer.domElement);

        // lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dir = new THREE.DirectionalLight(0xffffff, 0.6);
        dir.position.set(5, 10, 7);
        scene.add(dir);

        const group = new THREE.Group();
        scene.add(group);

        buildGeometry(THREE, group, kind, data);

        rendererRef.current = renderer; sceneRef.current = scene; cameraRef.current = camera; groupRef.current = group;

        const animate = () => {
          if (disposed) return;
          const r = 0.5;
          camera.position.x = dist.current * Math.sin(rot.current.y) * Math.cos(rot.current.x);
          camera.position.y = dist.current * Math.sin(rot.current.x);
          camera.position.z = dist.current * Math.cos(rot.current.y) * Math.cos(rot.current.x);
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(animate);
        };
        animate();
      } catch (e: any) { setError(e?.message || "3D failed to load"); }
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) { try { rendererRef.current.dispose(); rendererRef.current.forceContextLoss?.(); } catch (e) {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, JSON.stringify(data)]);

  function onDown(e: React.PointerEvent) { drag.current = { on: true, px: e.clientX, py: e.clientY }; }
  function onMove(e: React.PointerEvent) {
    if (!drag.current.on) return;
    const dx = e.clientX - drag.current.px, dy = e.clientY - drag.current.py;
    rot.current.y += dx * 0.01;
    rot.current.x = Math.max(-1.4, Math.min(1.4, rot.current.x + dy * 0.01));
    drag.current.px = e.clientX; drag.current.py = e.clientY;
  }
  function onUp() { drag.current.on = false; }
  function onWheel(e: React.WheelEvent) { dist.current = Math.max(4, Math.min(20, dist.current + (e.deltaY > 0 ? 0.8 : -0.8))); }

  function savePNG() {
    try {
      const r = rendererRef.current, s = sceneRef.current, c = cameraRef.current;
      if (!r) return;
      r.render(s, c);
      const url = r.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url; a.download = (title || "chart-3d").replace(/[^a-z0-9]+/gi, "_") + ".png"; a.click();
    } catch (e) {}
  }

  if (error) return <div className="text-signal text-[12px] p-3 border border-line rounded-[10px]">3D chart unavailable: {error}</div>;

  return (
    <div className="border border-line rounded-[12px] overflow-hidden bg-surface">
      <div className="flex items-center justify-between px-3 py-2 bg-well border-b border-line">
        <span className="mono text-[10px] uppercase tracking-wide text-muted-2">3D {kind} &middot; drag to rotate, scroll to zoom</span>
        <button onClick={savePNG} className="mono text-[10px] uppercase px-2 h-6 rounded border bg-surface border-line text-blue hover:border-blue">Save PNG</button>
      </div>
      <div ref={mountRef} style={{ width: "100%", height: 360, cursor: "grab", touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel} />
    </div>
  );
}

function buildGeometry(THREE: any, group: any, kind: Chart3DKind, data: Chart3DData) {
  // clear
  while (group.children.length) group.remove(group.children[0]);

  if (kind === "column") {
    const n = data.values.length || 1;
    const max = Math.max(1, ...data.values);
    const spacing = 1.6, totalW = (n - 1) * spacing;
    data.values.forEach((v, i) => {
      const h = (v / max) * 4 + 0.05;
      const geo = new THREE.BoxGeometry(0.9, h, 0.9);
      const mat = new THREE.MeshLambertMaterial({ color: PALETTE[i % PALETTE.length] });
      const cube = new THREE.Mesh(geo, mat);
      cube.position.set(i * spacing - totalW / 2, h / 2 - 2, 0);
      group.add(cube);
    });
    // base grid
    const grid = new THREE.GridHelper(Math.max(8, n * 2), Math.max(8, n * 2), 0xcccccc, 0xeeeeee);
    grid.position.y = -2;
    group.add(grid);
  }

  if (kind === "pie") {
    const total = data.values.reduce((a, b) => a + b, 0) || 1;
    let a0 = 0;
    const R = 3, depth = 0.8;
    data.values.forEach((v, i) => {
      const frac = v / total, a1 = a0 + frac * Math.PI * 2;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, R, a0, a1, false);
      shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      const mat = new THREE.MeshLambertMaterial({ color: PALETTE[i % PALETTE.length] });
      const slice = new THREE.Mesh(geo, mat);
      slice.rotation.x = -Math.PI / 2;
      // explode slightly
      const mid = (a0 + a1) / 2;
      slice.position.set(Math.cos(mid) * 0.15, 0, Math.sin(mid) * 0.15);
      group.add(slice);
      a0 = a1;
    });
  }

  if (kind === "scatter") {
    const pts = data.points || [];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
    const norm = (arr: number[], v: number) => { const mn = Math.min(...arr), mx = Math.max(...arr); return mx === mn ? 0 : ((v - mn) / (mx - mn)) * 6 - 3; };
    pts.forEach((p, i) => {
      const geo = new THREE.SphereGeometry(0.16, 16, 16);
      const mat = new THREE.MeshLambertMaterial({ color: PALETTE[i % PALETTE.length] });
      const s = new THREE.Mesh(geo, mat);
      s.position.set(norm(xs, p.x), norm(ys, p.y), norm(zs, p.z));
      group.add(s);
    });
    const axes = new THREE.AxesHelper(3.5);
    group.add(axes);
  }
}
