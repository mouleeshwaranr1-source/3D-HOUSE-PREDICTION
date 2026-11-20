import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  BlueprintAnalysisPayload,
  FuturePlanPayload,
  RoomGeometry,
} from '../../types/app';

export type StudioCameraPreset = 'iso' | 'top' | 'front' | 'side' | 'first_person';
export type StudioViewMode =
  | 'architectural'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'interior'
  | 'future';

const FLOOR_COLORS: Record<string, { base: string; grain: string }> = {
  'Oak Hardwood': { base: '#C7A983', grain: '#A9875D' },
  'Engineered Walnut': { base: '#8B6B4F', grain: '#6E513A' },
  'Porcelain Tile': { base: '#EAE9E4', grain: '#D4D2CA' },
  'Italian Marble': { base: '#F5F4F0', grain: '#CFCFC8' },
  'Polished Concrete': { base: '#C7C9CC', grain: '#AEB1B6' },
  Terrazzo: { base: '#E4E2DC', grain: '#B2B5BC' },
  'Acoustic Carpet': { base: '#D2D3D6', grain: '#BFC1C6' },
};

function createProceduralFloorTexture(
  materialName: string,
  tilePattern: string | undefined,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const palette = FLOOR_COLORS[materialName] || FLOOR_COLORS['Oak Hardwood'];

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = palette.grain;
  if (
    materialName.includes('Tile') ||
    materialName.includes('Marble') ||
    tilePattern === 'Large Format Grid'
  ) {
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (materialName.includes('Hardwood') || materialName.includes('Walnut')) {
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      const offset = (y / 32) % 2 === 0 ? 64 : 160;
      ctx.beginPath();
      ctx.moveTo(offset, y);
      ctx.lineTo(offset, y + 32);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = palette.grain;
      ctx.fillRect((i * 37) % 256, (i * 71) % 256, 3, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

function buildCompositeFurniture(f: RoomGeometry['furniture'][number]): THREE.Group {
  const g = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({
    color: f.color || '#D6D3CB',
    roughness: 0.72,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#3D4250',
    roughness: 0.35,
    metalness: 0.65,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: '#F3F2EE',
    roughness: 0.85,
    metalness: 0.02,
  });

  if (f.item === 'sofa') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(f.width, f.height * 0.45, f.depth), mainMat);
    base.position.y = f.height * 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(f.width, f.height * 0.65, f.depth * 0.22),
      mainMat
    );
    back.position.set(0, f.height * 0.55, -f.depth * 0.39);
    back.castShadow = true;
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(f.width * 0.1, f.height * 0.5, f.depth),
      mainMat
    );
    armL.position.set(-f.width * 0.45, f.height * 0.42, 0);
    const armR = armL.clone();
    armR.position.x = f.width * 0.45;
    g.add(base, back, armL, armR);
  } else if (f.item === 'bed') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(f.width, 0.25, f.depth), accentMat);
    frame.position.y = 0.14;
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(f.width * 0.94, 0.24, f.depth * 0.92),
      cushionMat
    );
    mattress.position.y = 0.36;
    mattress.castShadow = true;
    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(f.width, 0.95, 0.1),
      mainMat
    );
    headboard.position.set(0, 0.48, -f.depth * 0.47);
    const pillowL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.35), mainMat);
    pillowL.position.set(-f.width * 0.24, 0.52, -f.depth * 0.3);
    const pillowR = pillowL.clone();
    pillowR.position.x = f.width * 0.24;
    g.add(frame, mattress, headboard, pillowL, pillowR);
  } else if (f.item === 'dining_table' || f.item === 'coffee_table' || f.item === 'desk') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(f.width, 0.06, f.depth), mainMat);
    top.position.y = f.height - 0.03;
    top.castShadow = true;
    const legGeo = new THREE.CylinderGeometry(0.03, 0.025, f.height - 0.05, 8);
    const offsets = [
      [-f.width / 2 + 0.08, -f.depth / 2 + 0.08],
      [f.width / 2 - 0.08, -f.depth / 2 + 0.08],
      [-f.width / 2 + 0.08, f.depth / 2 - 0.08],
      [f.width / 2 - 0.08, f.depth / 2 - 0.08],
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, accentMat);
      leg.position.set(ox, (f.height - 0.05) / 2, oz);
      leg.castShadow = true;
      g.add(leg);
    });
    g.add(top);
  } else {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(f.width, f.height, f.depth), mainMat);
    cabinet.position.y = f.height / 2;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(f.width * 0.96, 0.08, f.depth * 0.96),
      accentMat
    );
    plinth.position.y = 0.04;
    g.add(cabinet, plinth);
  }

  return g;
}

export function HouseThreeCanvas({
  analysis,
  futurePlan,
  selectedFloor,
  selectedRoomId,
  onSelectRoom,
  cameraPreset,
  viewMode,
  showWalls,
  showCeilings,
  showFurniture,
  compareAfterInterior = true,
  className = '',
}: {
  analysis: BlueprintAnalysisPayload | null;
  futurePlan?: FuturePlanPayload | null;
  selectedFloor: number | 'all';
  selectedRoomId: string | null;
  onSelectRoom?: (roomId: string) => void;
  cameraPreset: StudioCameraPreset;
  viewMode: StudioViewMode;
  showWalls: boolean;
  showCeilings: boolean;
  showFurniture: boolean;
  compareAfterInterior?: boolean;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRoomRef = useRef(onSelectRoom);
  onSelectRoomRef.current = onSelectRoom;

  const sceneCtxRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    houseGroup: THREE.Group;
    clickables: THREE.Object3D[];
    targetCamPos: THREE.Vector3 | null;
    targetLookAt: THREE.Vector3 | null;
    requestRender: () => void;
    center: THREE.Vector3;
    span: number;
  } | null>(null);

  // Initialize Three.js WebGLRenderer once
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

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F7F6F2');
    scene.fog = new THREE.Fog('#F7F6F2', 35, 95);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(14, 12, 16);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
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

    // 3-point warm/cool architectural studio lighting
    const hemi = new THREE.HemisphereLight(0xeef3ff, 0xe8e5dc, 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff8ed, 1.35);
    keyLight.position.set(16, 24, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbe4ff, 0.45);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    // Subtle architectural drafting ground plane + grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#F1F0EC', roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(60, 60, 0x172d9b, 0xd8dae3);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 2.5;
    controls.maxDistance = 60;

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      let sync: WebGLSync | null = null;
      try {
        sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      } catch {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        try {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        } catch {
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const ctxObj = {
      scene,
      camera,
      renderer,
      controls,
      houseGroup,
      clickables: [] as THREE.Object3D[],
      targetCamPos: null as THREE.Vector3 | null,
      targetLookAt: null as THREE.Vector3 | null,
      requestRender: () => {},
      center: new THREE.Vector3(0, 1.5, 0),
      span: 14,
    };

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const delta = Math.min(0.05, clock.getDelta() || 0.016);
        let animating = false;

        if (ctxObj.targetCamPos && ctxObj.targetLookAt) {
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            ctxObj.targetCamPos.x,
            7,
            delta
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            ctxObj.targetCamPos.y,
            7,
            delta
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            ctxObj.targetCamPos.z,
            7,
            delta
          );
          controls.target.x = THREE.MathUtils.damp(
            controls.target.x,
            ctxObj.targetLookAt.x,
            7,
            delta
          );
          controls.target.y = THREE.MathUtils.damp(
            controls.target.y,
            ctxObj.targetLookAt.y,
            7,
            delta
          );
          controls.target.z = THREE.MathUtils.damp(
            controls.target.z,
            ctxObj.targetLookAt.z,
            7,
            delta
          );

          if (camera.position.distanceTo(ctxObj.targetCamPos) < 0.05) {
            ctxObj.targetCamPos = null;
            ctxObj.targetLookAt = null;
          } else {
            animating = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || animating) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    ctxObj.requestRender = requestRender;
    sceneCtxRef.current = ctxObj;

    controls.addEventListener('start', () => {
      ctxObj.targetCamPos = null;
      ctxObj.targetLookAt = null;
    });
    controls.addEventListener('change', requestRender);

    // Raycast room click
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(ctxObj.clickables, false);
      if (hits.length > 0 && hits[0].object.userData.roomId) {
        onSelectRoomRef.current?.(hits[0].object.userData.roomId);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    ro.observe(container);

    // First-person WASD navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      const step = 0.6;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

      if (e.key === 'w' || e.key === 'W') {
        camera.position.addScaledVector(forward, step);
        controls.target.addScaledVector(forward, step);
        requestRender();
      } else if (e.key === 's' || e.key === 'S') {
        camera.position.addScaledVector(forward, -step);
        controls.target.addScaledVector(forward, -step);
        requestRender();
      } else if (e.key === 'a' || e.key === 'A') {
        camera.position.addScaledVector(right, -step);
        controls.target.addScaledVector(right, -step);
        requestRender();
      } else if (e.key === 'd' || e.key === 'D') {
        camera.position.addScaledVector(right, step);
        controls.target.addScaledVector(right, step);
        requestRender();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Rebuild architectural geometry when project/layers/materials change
  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;

    // Clear old children & dispose geometries/materials/textures
    while (ctx.houseGroup.children.length > 0) {
      const child = ctx.houseGroup.children[0];
      child.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      ctx.houseGroup.remove(child);
    }
    ctx.clickables = [];

    const allRooms = analysis?.rooms || [];
    const visibleRooms =
      selectedFloor === 'all'
        ? allRooms
        : allRooms.filter((r) => (r.floor || 1) === selectedFloor);

    if (visibleRooms.length === 0) {
      ctx.requestRender();
      return;
    }

    const minX = Math.min(...allRooms.map((r) => r.x));
    const maxX = Math.max(...allRooms.map((r) => r.x + r.width));
    const minZ = Math.min(...allRooms.map((r) => r.z));
    const maxZ = Math.max(...allRooms.map((r) => r.z + r.depth));
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    ctx.span = Math.max(8, maxX - minX, maxZ - minZ);
    ctx.center.set(0, 1.5, 0);

    const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();

    visibleRooms.forEach((room) => {
      const floorLevel = (room.floor || 1) - 1;
      const floorY = floorLevel * 3.15;
      const rx = room.x - centerX;
      const rz = room.z - centerZ;
      const rw = room.width;
      const rd = room.depth;
      const rh = room.height || 3.0;
      const isSelected = selectedRoomId === room.id;

      // Room Floor Slab
      const floorTex = createProceduralFloorTexture(
        compareAfterInterior ? room.floorMaterial : 'Polished Concrete',
        room.tilePattern,
        maxAniso
      );
      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        color: isSelected ? '#DCE3FF' : '#FFFFFF',
        roughness: 0.75,
        metalness: 0.04,
      });
      const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.14, rd), floorMat);
      floorSlab.position.set(rx + rw / 2, floorY + 0.07, rz + rd / 2);
      floorSlab.receiveShadow = true;
      floorSlab.userData.roomId = room.id;
      ctx.houseGroup.add(floorSlab);
      ctx.clickables.push(floorSlab);

      // Selected room blueprint outline highlight
      if (isSelected) {
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(rw + 0.04, 0.16, rd + 0.04));
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x3049f5 })
        );
        line.position.copy(floorSlab.position);
        ctx.houseGroup.add(line);
      }

      // Room Walls (with real window cutouts or glazed frames)
      if (showWalls) {
        const wallColor = compareAfterInterior ? room.wallColor || '#F7F7F4' : '#ECEBE6';
        const isWireframeMode = viewMode === 'structural' || viewMode === 'electrical' || viewMode === 'plumbing';
        const wallMat = new THREE.MeshStandardMaterial({
          color: wallColor,
          roughness: 0.84,
          metalness: 0.02,
          transparent: isWireframeMode,
          opacity: isWireframeMode ? 0.24 : 1,
          depthWrite: !isWireframeMode,
        });
        const wallThickness = 0.14;

        const addWall = (
          wx: number,
          wz: number,
          len: number,
          rotY: number,
          sideKey: 'north' | 'south' | 'east' | 'west'
        ) => {
          const wallMesh = new THREE.Mesh(
            new THREE.BoxGeometry(len, rh, wallThickness),
            wallMat
          );
          wallMesh.position.set(wx, floorY + 0.14 + rh / 2, wz);
          wallMesh.rotation.y = rotY;
          wallMesh.castShadow = !isWireframeMode;
          wallMesh.receiveShadow = true;
          wallMesh.userData.roomId = room.id;
          ctx.houseGroup.add(wallMesh);
          ctx.clickables.push(wallMesh);

          // Glazed windows on this wall
          (room.windows || [])
            .filter((w) => w.wall === sideKey)
            .forEach((win) => {
              const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xbfe0ff,
                roughness: 0.1,
                metalness: 0.1,
                transparent: true,
                opacity: 0.55,
              });
              const frameMat = new THREE.MeshStandardMaterial({
                color: '#172D9B',
                roughness: 0.4,
                metalness: 0.5,
              });
              const offsetLocal = (win.offset - 0.5) * len;
              const winMesh = new THREE.Mesh(
                new THREE.BoxGeometry(Math.min(len * 0.7, win.width), win.height || 1.2, wallThickness + 0.04),
                glassMat
              );
              const frameMesh = new THREE.Mesh(
                new THREE.BoxGeometry(Math.min(len * 0.7, win.width) + 0.06, (win.height || 1.2) + 0.06, wallThickness + 0.02),
                frameMat
              );
              const wy = floorY + 0.14 + (win.sillHeight || 0.9) + (win.height || 1.2) / 2;
              if (rotY === 0) {
                winMesh.position.set(wx + offsetLocal, wy, wz);
                frameMesh.position.set(wx + offsetLocal, wy, wz);
              } else {
                winMesh.rotation.y = rotY;
                frameMesh.rotation.y = rotY;
                winMesh.position.set(wx, wy, wz + offsetLocal);
                frameMesh.position.set(wx, wy, wz + offsetLocal);
              }
              ctx.houseGroup.add(frameMesh, winMesh);
            });

          // Doors on this wall
          (room.doors || [])
            .filter((d) => d.wall === sideKey)
            .forEach((door) => {
              const doorMat = new THREE.MeshStandardMaterial({
                color: '#8E6E4E',
                roughness: 0.65,
                metalness: 0.05,
              });
              const offsetLocal = (door.offset - 0.5) * len;
              const dMesh = new THREE.Mesh(
                new THREE.BoxGeometry(door.width || 0.9, 2.1, wallThickness + 0.05),
                doorMat
              );
              const dy = floorY + 0.14 + 1.05;
              if (rotY === 0) {
                dMesh.position.set(wx + offsetLocal, dy, wz);
              } else {
                dMesh.rotation.y = rotY;
                dMesh.position.set(wx, dy, wz + offsetLocal);
              }
              ctx.houseGroup.add(dMesh);
            });
        };

        addWall(rx + rw / 2, rz, rw, 0, 'north');
        addWall(rx + rw / 2, rz + rd, rw, 0, 'south');
        addWall(rx, rz + rd / 2, rd, Math.PI / 2, 'west');
        addWall(rx + rw, rz + rd / 2, rd, Math.PI / 2, 'east');
      }

      // Ceiling slab & recessed lighting
      if (showCeilings) {
        const ceilMat = new THREE.MeshStandardMaterial({
          color: room.ceilingStyle === 'Acoustic Timber' ? '#C7A983' : '#FFFFFF',
          roughness: 0.85,
          metalness: 0.02,
        });
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.14, 0.14, rd + 0.14), ceilMat);
        ceil.position.set(rx + rw / 2, floorY + 0.14 + rh + 0.07, rz + rd / 2);
        ceil.castShadow = true;
        ctx.houseGroup.add(ceil);
      }

      // Furniture
      if (showFurniture && room.furniture) {
        room.furniture.forEach((f) => {
          const furn = buildCompositeFurniture(f);
          furn.position.set(rx + f.x, floorY + 0.14, rz + f.z);
          furn.rotation.y = f.rotationY || 0;
          ctx.houseGroup.add(furn);
        });
      }

      // STRUCTURAL COLUMNS & BEAMS OVERLAY
      if (viewMode === 'structural') {
        const colMat = new THREE.MeshStandardMaterial({
          color: '#172D9B',
          roughness: 0.4,
          metalness: 0.35,
        });
        const corners = [
          [rx, rz],
          [rx + rw, rz],
          [rx, rz + rd],
          [rx + rw, rz + rd],
        ];
        corners.forEach(([cx, cz]) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh + 0.2, 0.24), colMat);
          col.position.set(cx, floorY + 0.14 + rh / 2, cz);
          ctx.houseGroup.add(col);
        });

        const beamMat = new THREE.MeshStandardMaterial({
          color: '#3049F5',
          roughness: 0.45,
          metalness: 0.25,
        });
        const beamN = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.22, 0.22), beamMat);
        beamN.position.set(rx + rw / 2, floorY + rh + 0.14, rz);
        const beamS = beamN.clone();
        beamS.position.z = rz + rd;
        ctx.houseGroup.add(beamN, beamS);
      }

      // ELECTRICAL LAYOUT 3D OVERLAY
      if (viewMode === 'electrical') {
        const dbPos = analysis?.electricalSummary?.mainDbLocation || { x: minX + 1, z: minZ + 1 };
        const dbX = dbPos.x - centerX;
        const dbZ = dbPos.z - centerZ;

        // Ceiling light fixtures + conduit run
        const lightCount = Math.max(1, room.electrical?.lights || 1);
        for (let i = 0; i < lightCount; i++) {
          const lx = rx + ((i + 1) / (lightCount + 1)) * rw;
          const lz = rz + rd / 2;
          const ly = floorY + rh - 0.12;

          const lamp = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16),
            new THREE.MeshStandardMaterial({
              color: '#3049F5',
              emissive: '#3049F5',
              emissiveIntensity: 0.35,
            })
          );
          lamp.position.set(lx, ly, lz);
          ctx.houseGroup.add(lamp);

          const wirePts = [
            new THREE.Vector3(dbX, floorY + 2.4, dbZ),
            new THREE.Vector3(dbX, ly, dbZ),
            new THREE.Vector3(lx, ly, lz),
          ];
          const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePts);
          ctx.houseGroup.add(
            new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x3049f5 }))
          );
        }

        // Socket & switch points along walls
        const sockets = room.electrical?.sockets || 2;
        for (let s = 0; s < Math.min(4, sockets); s++) {
          const sx = rx + ((s + 1) / (Math.min(4, sockets) + 1)) * rw;
          const socketBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.14, 0.08),
            new THREE.MeshStandardMaterial({ color: '#E8A13A' })
          );
          socketBox.position.set(sx, floorY + 0.55, rz + 0.08);
          ctx.houseGroup.add(socketBox);
        }
      }

      // PLUMBING LAYOUT 3D OVERLAY
      if (viewMode === 'plumbing' && (room.plumbing?.drainPoints > 0 || room.plumbing?.coldOutlets > 0)) {
        const riserPos = analysis?.plumbingSummary?.mainRiserLocation || { x: minX + 1.5, z: minZ + 1.5 };
        const rxMain = riserPos.x - centerX;
        const rzMain = riserPos.z - centerZ;

        // Cold water pipe (blue)
        const coldPts = [
          new THREE.Vector3(rxMain, floorY + 2.5, rzMain),
          new THREE.Vector3(rx + rw / 2, floorY + 2.5, rz + rd / 2),
          new THREE.Vector3(rx + rw / 2, floorY + 0.8, rz + rd / 2),
        ];
        ctx.houseGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(coldPts),
            new THREE.LineBasicMaterial({ color: 0x3049f5 })
          )
        );

        // Hot water pipe (red/coral)
        if (room.plumbing.hotOutlets > 0) {
          const hotPts = [
            new THREE.Vector3(rxMain + 0.15, floorY + 2.35, rzMain),
            new THREE.Vector3(rx + rw / 2 + 0.15, floorY + 2.35, rz + rd / 2),
            new THREE.Vector3(rx + rw / 2 + 0.15, floorY + 0.8, rz + rd / 2),
          ];
          ctx.houseGroup.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(hotPts),
              new THREE.LineBasicMaterial({ color: 0xd94a50 })
            )
          );
        }

        // Drainage pipe (green)
        const drainPts = [
          new THREE.Vector3(rx + rw / 2 - 0.15, floorY + 0.25, rz + rd / 2),
          new THREE.Vector3(rxMain - 0.15, floorY + 0.2, rzMain),
          new THREE.Vector3(rxMain - 0.15, 0.05, rzMain),
        ];
        ctx.houseGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(drainPts),
            new THREE.LineBasicMaterial({ color: 0x249b67 })
          )
        );
      }
    });

    // Main Distribution Board & Water Tank markers in MEP views
    if (viewMode === 'electrical' && analysis?.electricalSummary?.mainDbLocation) {
      const db = analysis.electricalSummary.mainDbLocation;
      const dbMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.7, 0.18),
        new THREE.MeshStandardMaterial({ color: '#172D9B', metalness: 0.4, roughness: 0.4 })
      );
      dbMesh.position.set(db.x - centerX, 1.5, db.z - centerZ);
      ctx.houseGroup.add(dbMesh);
    }

    if (viewMode === 'plumbing' && analysis?.plumbingSummary?.waterTankLocation) {
      const wt = analysis.plumbingSummary.waterTankLocation;
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.1, 20),
        new THREE.MeshStandardMaterial({ color: '#3049F5', roughness: 0.45, metalness: 0.2 })
      );
      tank.position.set(wt.x - centerX, (analysis.floors || 1) * 3.15 + 0.7, wt.z - centerZ);
      ctx.houseGroup.add(tank);
    }

    // FUTURE HOUSE ADDITIONS OVERLAY
    if (viewMode === 'future' && futurePlan?.additions?.length) {
      futurePlan.additions.forEach((add) => {
        const fy = ((add.floor || 1) - 1) * 3.15;
        const ax = add.x - centerX;
        const az = add.z - centerZ;
        const volGeo = new THREE.BoxGeometry(add.width, add.height || 3.0, add.depth);
        const volMat = new THREE.MeshStandardMaterial({
          color: '#3049F5',
          transparent: true,
          opacity: 0.28,
          roughness: 0.5,
        });
        const volMesh = new THREE.Mesh(volGeo, volMat);
        volMesh.position.set(ax + add.width / 2, fy + (add.height || 3.0) / 2 + 0.14, az + add.depth / 2);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(volGeo),
          new THREE.LineBasicMaterial({ color: 0x172d9b })
        );
        edges.position.copy(volMesh.position);
        ctx.houseGroup.add(volMesh, edges);
      });
    }

    ctx.requestRender();
  }, [
    analysis,
    futurePlan,
    selectedFloor,
    selectedRoomId,
    viewMode,
    showWalls,
    showCeilings,
    showFurniture,
    compareAfterInterior,
  ]);

  // Smooth camera preset transitions
  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;
    const d = ctx.span * 1.15;

    if (cameraPreset === 'top') {
      ctx.targetCamPos = new THREE.Vector3(0, d * 1.35, 0.01);
      ctx.targetLookAt = new THREE.Vector3(0, 0, 0);
    } else if (cameraPreset === 'front') {
      ctx.targetCamPos = new THREE.Vector3(0, 3.2, d * 1.25);
      ctx.targetLookAt = new THREE.Vector3(0, 1.5, 0);
    } else if (cameraPreset === 'side') {
      ctx.targetCamPos = new THREE.Vector3(d * 1.25, 3.2, 0);
      ctx.targetLookAt = new THREE.Vector3(0, 1.5, 0);
    } else if (cameraPreset === 'first_person') {
      ctx.targetCamPos = new THREE.Vector3(0, 1.65, 2.2);
      ctx.targetLookAt = new THREE.Vector3(0, 1.6, -2.5);
    } else {
      ctx.targetCamPos = new THREE.Vector3(d * 0.9, d * 0.72, d * 0.95);
      ctx.targetLookAt = new THREE.Vector3(0, 1.2, 0);
    }
    ctx.requestRender();
  }, [cameraPreset]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full min-h-[460px] rounded-lg overflow-hidden ${className}`}
    />
  );
}
