import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Layers, RotateCcw } from 'lucide-react';

function createBlueprintPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich royal-blue blueprint base matching the architectural reference
  ctx.fillStyle = '#1D36B8';
  ctx.fillRect(0, 0, size, size);

  // Subtle cross-hatched drafting ink texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size * 0.4, size);
    ctx.stroke();
  }

  // Minor grid lines
  ctx.strokeStyle = 'rgba(208, 220, 255, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Major blueprint grid lines
  ctx.strokeStyle = 'rgba(238, 241, 255, 0.34)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Crisp technical border frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, size - 20, size - 20);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

function createFloorTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F7F6F2';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#DCE0EE';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

function createRoofLineTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#3049F5';
  ctx.lineWidth = 2;
  for (let y = 0; y <= size; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

function addArchitecturalEdges(
  mesh: THREE.Mesh,
  parent: THREE.Object3D,
  lineColor = 0x172d9b,
  thresholdAngle = 15
) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: lineColor })
  );
  line.position.copy(mesh.position);
  line.rotation.copy(mesh.rotation);
  line.scale.copy(mesh.scale);
  parent.add(line);
}

export function AuthHouse3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [roofLifted, setRoofLifted] = useState(true);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const roofLiftedRef = useRef(true);
  const resetCamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    roofLiftedRef.current = roofLifted;
  }, [roofLifted]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 640;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F1F0EC');
    scene.fog = new THREE.Fog('#F1F0EC', 26, 60);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 120);
    const defaultCamPos = new THREE.Vector3(10.8, 8.6, 11.4);
    const defaultLookAt = new THREE.Vector3(0, 1.9, 0);
    camera.position.copy(defaultCamPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Architectural Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xf3f6ff, 0xe8e5dc, 0.82);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.3);
    keyLight.position.set(11, 18, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 9;
    keyLight.shadow.camera.bottom = -9;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd4e0ff, 0.52);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [];

    // Ground plane for soft shadow grounding
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const shadowPlaneGeo = new THREE.PlaneGeometry(36, 36);
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.02;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
    disposables.push(shadowPlaneMat, shadowPlaneGeo);

    // Master rotating house assembly
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // 1. Royal-Blue Blueprint Pad / Site Base
    const blueprintTex = createBlueprintPadTexture(maxAniso);
    const padMat = new THREE.MeshStandardMaterial({
      map: blueprintTex,
      roughness: 0.85,
      metalness: 0.04,
    });
    const padSideMat = new THREE.MeshStandardMaterial({
      color: '#172D9B',
      roughness: 0.65,
      metalness: 0.12,
    });
    const padGeo = new THREE.BoxGeometry(8.6, 0.16, 7.2);
    const padMesh = new THREE.Mesh(padGeo, [
      padSideMat,
      padSideMat,
      padMat,
      padSideMat,
      padSideMat,
      padSideMat,
    ]);
    padMesh.position.set(0, 0.08, 0);
    padMesh.receiveShadow = true;
    stageGroup.add(padMesh);
    disposables.push(blueprintTex, padMat, padSideMat, padGeo);

    // 2. White Architectural Floor Slab
    const tileTex = createFloorTileTexture(maxAniso);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tileTex,
      roughness: 0.72,
      metalness: 0.03,
    });
    const floorSlabGeo = new THREE.BoxGeometry(6.2, 0.18, 5.0);
    const floorSlab = new THREE.Mesh(floorSlabGeo, floorMat);
    floorSlab.position.set(0, 0.25, 0);
    floorSlab.castShadow = true;
    floorSlab.receiveShadow = true;
    stageGroup.add(floorSlab);
    addArchitecturalEdges(floorSlab, stageGroup, 0x172d9b, 20);
    disposables.push(tileTex, floorMat, floorSlabGeo);

    // Shared Architectural Materials
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.84,
      metalness: 0.02,
    });
    const blueTrimMat = new THREE.MeshStandardMaterial({
      color: '#172D9B',
      roughness: 0.42,
      metalness: 0.35,
    });
    const accentBlueMat = new THREE.MeshStandardMaterial({
      color: '#3049F5',
      roughness: 0.45,
      metalness: 0.22,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#C7D8FF',
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1.0,
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: '#A9875D',
      roughness: 0.68,
      metalness: 0.04,
    });
    const sofaMat = new THREE.MeshStandardMaterial({
      color: '#3049F5',
      roughness: 0.76,
      metalness: 0.04,
    });
    const linenMat = new THREE.MeshStandardMaterial({
      color: '#ECEBE6',
      roughness: 0.88,
      metalness: 0.01,
    });
    disposables.push(
      wallMat,
      blueTrimMat,
      accentBlueMat,
      glassMat,
      timberMat,
      sofaMat,
      linenMat
    );

    const addBox = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      edgeColor: number | null = 0x172d9b,
      cast = true
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      if (edgeColor !== null) {
        addArchitecturalEdges(mesh, parent, edgeColor, 20);
      }
      disposables.push(geo);
      return mesh;
    };

    // 3. Exterior Walls (with real doorway & window openings)
    const wallY = 0.34; // top of floor slab
    const wallH = 2.05;
    const wallMidY = wallY + wallH / 2;
    const t = 0.16;

    // Back wall (North, z = -2.42) - with left window opening
    addBox(stageGroup, 2.0, wallH, t, -2.1, wallMidY, -2.42, wallMat);
    addBox(stageGroup, 2.6, wallH, t, 1.8, wallMidY, -2.42, wallMat);
    addBox(stageGroup, 1.6, 0.65, t, -0.3, wallY + 0.325, -2.42, wallMat);
    addBox(stageGroup, 1.6, 0.45, t, -0.3, wallY + wallH - 0.225, -2.42, wallMat);
    addBox(stageGroup, 1.56, 0.94, 0.06, -0.3, wallY + 1.12, -2.42, glassMat, 0x3049f5, false);

    // Left wall (West, x = -3.02) - with picture window
    addBox(stageGroup, t, wallH, 1.5, -3.02, wallMidY, -1.75, wallMat);
    addBox(stageGroup, t, wallH, 1.5, -3.02, wallMidY, 1.75, wallMat);
    addBox(stageGroup, t, 0.65, 2.0, -3.02, wallY + 0.325, 0, wallMat);
    addBox(stageGroup, t, 0.45, 2.0, -3.02, wallY + wallH - 0.225, 0, wallMat);
    addBox(stageGroup, 0.06, 0.94, 1.96, -3.02, wallY + 1.12, 0, glassMat, 0x3049f5, false);

    // Right wall (East, x = 3.02) - with twin windows
    addBox(stageGroup, t, wallH, 1.4, 3.02, wallMidY, -1.8, wallMat);
    addBox(stageGroup, t, wallH, 1.4, 3.02, wallMidY, 1.8, wallMat);
    addBox(stageGroup, t, 0.65, 2.2, 3.02, wallY + 0.325, 0, wallMat);
    addBox(stageGroup, t, 0.45, 2.2, 3.02, wallY + wallH - 0.225, 0, wallMat);
    addBox(stageGroup, 0.06, 0.94, 2.16, 3.02, wallY + 1.12, 0, glassMat, 0x3049f5, false);

    // Front wall (South, z = +2.42) - doorway + flanking windows (matching reference cutout)
    // Far left pier
    addBox(stageGroup, 0.7, wallH, t, -2.75, wallMidY, 2.42, wallMat);
    // Left window bay
    addBox(stageGroup, 1.1, 0.65, t, -1.85, wallY + 0.325, 2.42, wallMat);
    addBox(stageGroup, 1.1, 0.42, t, -1.85, wallY + wallH - 0.21, 2.42, wallMat);
    addBox(stageGroup, 1.06, 0.97, 0.06, -1.85, wallY + 1.14, 2.42, glassMat, 0x3049f5, false);
    // Center pier left of door
    addBox(stageGroup, 0.65, wallH, t, -0.97, wallMidY, 2.42, wallMat);
    // Front door lintel + architectural door panel
    addBox(stageGroup, 1.05, 0.42, t, -0.12, wallY + wallH - 0.21, 2.42, wallMat);
    addBox(stageGroup, 0.94, 1.6, 0.08, -0.12, wallY + 0.8, 2.42, timberMat, 0x172d9b);
    addBox(stageGroup, 0.08, 0.22, 0.12, 0.22, wallY + 0.82, 2.44, blueTrimMat, null, false);
    // Right pier + wide living room window
    addBox(stageGroup, 0.75, wallH, t, 0.78, wallMidY, 2.42, wallMat);
    addBox(stageGroup, 1.25, 0.65, t, 1.78, wallY + 0.325, 2.42, wallMat);
    addBox(stageGroup, 1.25, 0.42, t, 1.78, wallY + wallH - 0.21, 2.42, wallMat);
    addBox(stageGroup, 1.21, 0.97, 0.06, 1.78, wallY + 1.14, 2.42, glassMat, 0x3049f5, false);
    addBox(stageGroup, 0.7, wallH, t, 2.75, wallMidY, 2.42, wallMat);

    // Front porch entry step
    addBox(stageGroup, 1.4, 0.12, 0.55, -0.12, 0.2, 2.76, wallMat, 0x172d9b);

    // 4. Interior Partition Walls (Floor Plan Layout)
    const intH = 1.82;
    const intY = wallY + intH / 2;
    // Central hallway spine
    addBox(stageGroup, 0.12, intH, 2.3, 0.35, intY, -1.25, wallMat);
    // Bedroom divider (left rear)
    addBox(stageGroup, 2.1, intH, 0.12, -1.9, intY, -0.25, wallMat);
    // Kitchen / bath partition (right rear)
    addBox(stageGroup, 1.8, intH, 0.12, 2.05, intY, -0.35, wallMat);

    // 5. Detailed Interior Furniture (Living Room, Bedroom, Kitchen, Dining)
    // Living Room (Front Right) - L-style sofa + coffee table + rug
    addBox(stageGroup, 1.55, 0.03, 1.15, 1.68, wallY + 0.02, 1.2, linenMat, 0x3049f5, false);
    addBox(stageGroup, 1.4, 0.28, 0.62, 1.7, wallY + 0.16, 0.72, sofaMat, 0x172d9b);
    addBox(stageGroup, 1.4, 0.34, 0.14, 1.7, wallY + 0.35, 0.48, blueTrimMat, 0x172d9b);
    addBox(stageGroup, 0.75, 0.22, 0.44, 1.7, wallY + 0.12, 1.38, timberMat, 0x172d9b);

    // Bedroom (Back Left) - Bed frame + mattress + pillows + nightstand
    addBox(stageGroup, 1.45, 0.22, 1.65, -1.95, wallY + 0.12, -1.42, blueTrimMat, 0x172d9b);
    addBox(stageGroup, 1.34, 0.18, 1.52, -1.95, wallY + 0.28, -1.42, linenMat, 0x172d9b);
    addBox(stageGroup, 0.52, 0.1, 0.32, -2.28, wallY + 0.41, -1.94, wallMat, 0x3049f5);
    addBox(stageGroup, 0.52, 0.1, 0.32, -1.62, wallY + 0.41, -1.94, wallMat, 0x3049f5);
    addBox(stageGroup, 0.38, 0.36, 0.38, -2.72, wallY + 0.18, -2.02, timberMat, 0x172d9b);

    // Kitchen / Island (Back Right)
    addBox(stageGroup, 1.75, 0.62, 0.52, 1.85, wallY + 0.31, -2.04, wallMat, 0x172d9b);
    addBox(stageGroup, 1.1, 0.58, 0.52, 1.75, wallY + 0.29, -1.08, accentBlueMat, 0x172d9b);

    // Dining Table & Chairs (Front Left)
    addBox(stageGroup, 1.05, 0.06, 0.72, -1.85, wallY + 0.52, 1.15, timberMat, 0x172d9b);
    addBox(stageGroup, 0.1, 0.5, 0.1, -2.28, wallY + 0.25, 0.88, blueTrimMat, null);
    addBox(stageGroup, 0.1, 0.5, 0.1, -1.42, wallY + 0.25, 0.88, blueTrimMat, null);
    addBox(stageGroup, 0.1, 0.5, 0.1, -2.28, wallY + 0.25, 1.42, blueTrimMat, null);
    addBox(stageGroup, 0.1, 0.5, 0.1, -1.42, wallY + 0.25, 1.42, blueTrimMat, null);

    // 6. Floating / Exploded Pitched Gable Roof Assembly (Hero Cutaway Feature)
    const roofGroup = new THREE.Group();
    const roofRestY = wallY + wallH + 0.02;
    const roofLiftY = wallY + wallH + 1.55;
    roofGroup.position.y = roofLiftY;
    stageGroup.add(roofGroup);

    // Gable end-cap triangular prism built with ExtrudeGeometry
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-3.28, 0);
    gableShape.lineTo(0, 1.62);
    gableShape.lineTo(3.28, 0);
    gableShape.closePath();

    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: 5.2,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    gableGeo.translate(0, 0, -2.6);

    const roofLineTex = createRoofLineTexture(maxAniso);
    const roofFaceMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: roofLineTex,
      roughness: 0.75,
      metalness: 0.05,
    });
    const gableMesh = new THREE.Mesh(gableGeo, roofFaceMat);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    roofGroup.add(gableMesh);
    addArchitecturalEdges(gableMesh, roofGroup, 0x172d9b, 18);
    disposables.push(gableGeo, roofLineTex, roofFaceMat);

    // Royal-blue roof fascia band & ridge beam
    addBox(roofGroup, 6.68, 0.14, 5.4, 0, 0.04, 0, blueTrimMat, 0x172d9b);
    addBox(roofGroup, 0.16, 0.14, 5.46, 0, 1.64, 0, accentBlueMat, 0x172d9b);

    // Architectural skylights / roof dormers on front slope
    const skylightL = addBox(roofGroup, 0.92, 0.12, 1.25, -1.3, 0.96, 0.95, glassMat, 0x172d9b, false);
    skylightL.rotation.z = Math.atan2(1.62, 3.28);
    const skylightR = addBox(roofGroup, 0.92, 0.12, 1.25, 1.3, 0.96, -0.85, glassMat, 0x172d9b, false);
    skylightR.rotation.z = -Math.atan2(1.62, 3.28);

    // Dashed royal-blue projection guidelines connecting walls to exploded roof
    const guideGroup = new THREE.Group();
    const guideCorners = [
      [-3.08, -2.48],
      [3.08, -2.48],
      [-3.08, 2.48],
      [3.08, 2.48],
    ];
    const guideLineMat = new THREE.LineDashedMaterial({
      color: 0x3049f5,
      dashSize: 0.18,
      gapSize: 0.14,
      transparent: true,
      opacity: 0.7,
    });
    disposables.push(guideLineMat);

    guideCorners.forEach(([cx, cz]) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, wallY + wallH, cz),
        new THREE.Vector3(cx, roofLiftY, cz),
      ]);
      const dashedLine = new THREE.Line(lineGeo, guideLineMat);
      dashedLine.computeLineDistances();
      guideGroup.add(dashedLine);
      disposables.push(lineGeo);
    });
    stageGroup.add(guideGroup);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.copy(defaultLookAt);
    controls.minDistance = 6.5;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minPolarAngle = 0.25;

    let userInteracting = false;
    let targetResetCam: THREE.Vector3 | null = null;
    let targetResetLook: THREE.Vector3 | null = null;

    controls.addEventListener('start', () => {
      userInteracting = true;
      targetResetCam = null;
      targetResetLook = null;
    });
    controls.addEventListener('end', () => {
      userInteracting = false;
    });

    resetCamRef.current = () => {
      targetResetCam = defaultCamPos.clone();
      targetResetLook = defaultLookAt.clone();
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(0.05, clock.getDelta() || 0.016);
      const elapsed = clock.getElapsedTime();

      // Gentle architectural turntable rotation when not actively dragging
      if (!userInteracting) {
        stageGroup.rotation.y += delta * 0.22;
      }

      // Smooth damped roof lift/settle + subtle floating hover when lifted
      const baseRoofTarget = roofLiftedRef.current
        ? roofLiftY + Math.sin(elapsed * 1.4) * 0.07
        : roofRestY;
      roofGroup.position.y = THREE.MathUtils.damp(
        roofGroup.position.y,
        baseRoofTarget,
        5.5,
        delta
      );
      guideGroup.visible = roofGroup.position.y > roofRestY + 0.18;

      if (targetResetCam && targetResetLook) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetResetCam.x, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetResetCam.y, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetResetCam.z, 7, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetResetLook.x, 7, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, targetResetLook.y, 7, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetResetLook.z, 7, delta);
        if (camera.position.distanceTo(targetResetCam) < 0.04) {
          targetResetCam = null;
          targetResetLook = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const ro = new ResizeObserver(() => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.dispose();
      stageGroup.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
      disposables.forEach((d) => d.dispose());
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-screen bg-[#F1F0EC] overflow-hidden">
      {webglUnavailable ? (
        <div className="w-full h-full min-h-[300px] sm:min-h-screen flex items-center justify-center p-8">
          <svg
            viewBox="0 0 420 340"
            className="w-full max-w-[420px] h-auto"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="3D cutaway architectural house vector preview"
          >
            <polygon points="45,245 210,175 375,245 210,315" fill="#1D36B8" stroke="#172D9B" strokeWidth="2" />
            <polygon points="95,215 210,165 325,215 325,260 210,305 95,260" fill="#FFFFFF" stroke="#172D9B" strokeWidth="2" />
            <polygon points="105,115 210,60 315,115 210,165" fill="#FFFFFF" stroke="#172D9B" strokeWidth="2" />
            <line x1="95" y1="215" x2="105" y2="115" stroke="#3049F5" strokeWidth="1.2" strokeDasharray="4 4" />
            <line x1="325" y1="215" x2="315" y2="115" stroke="#3049F5" strokeWidth="1.2" strokeDasharray="4 4" />
          </svg>
        </div>
      ) : (
        <>
          <div
            ref={mountRef}
            aria-label="Interactive 3D cutaway architectural house model"
            className="w-full h-full min-h-[300px] sm:min-h-screen cursor-grab active:cursor-grabbing"
          />

          {/* Minimal unobtrusive architectural 3D controls at bottom-right */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={() => setRoofLifted((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#172D9B] bg-[#FFFFFF] border border-[#E5E6EB] rounded-lg hover:border-[#3049F5] transition-colors cursor-pointer"
              title={roofLifted ? 'Assemble roof onto walls' : 'Lift roof to inspect floor plan'}
            >
              <Layers size={13} className="text-[#3049F5]" />
              <span>{roofLifted ? 'Assemble Roof' : 'Cutaway Roof'}</span>
            </button>
            <button
              type="button"
              onClick={() => resetCamRef.current?.()}
              className="inline-flex items-center justify-center p-1.5 text-[#172D9B] bg-[#FFFFFF] border border-[#E5E6EB] rounded-lg hover:border-[#3049F5] transition-colors cursor-pointer"
              aria-label="Reset 3D camera"
              title="Reset camera"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
