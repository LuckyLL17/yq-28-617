import { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { create } from 'zustand';
import * as THREE from 'three';
import { useGameStore, materialProperties, generateId, BlockData, GravityDirection } from '@/store/gameStore';

const GRID_SIZE = 1;
const GRID_HALF = 20;
const BLOCK_HEIGHT = 1;
const BLOCK_UNIT = BLOCK_HEIGHT * 0.95;
const HALF_BLOCK = BLOCK_UNIT / 2;
const ROTATION_STEP = Math.PI / 2;
const MAX_HEIGHT_LEVEL = 30;

type StackAxis = 'x' | 'y' | 'z';

interface BuildGravityInfo {
  stackAxis: StackAxis;
  stackSign: number;
  groundPos: number;
  groundNormal: THREE.Vector3;
  gridUAxis: 'x' | 'y' | 'z';
  gridVAxis: 'x' | 'y' | 'z';
  groundRotation: [number, number, number];
}

function getBuildGravityInfo(direction: GravityDirection): BuildGravityInfo {
  switch (direction) {
    case 'down':
    default:
      return {
        stackAxis: 'y',
        stackSign: 1,
        groundPos: 0,
        groundNormal: new THREE.Vector3(0, 1, 0),
        gridUAxis: 'x',
        gridVAxis: 'z',
        groundRotation: [-Math.PI / 2, 0, 0],
      };
    case 'up':
      return {
        stackAxis: 'y',
        stackSign: -1,
        groundPos: 50,
        groundNormal: new THREE.Vector3(0, -1, 0),
        gridUAxis: 'x',
        gridVAxis: 'z',
        groundRotation: [Math.PI / 2, 0, 0],
      };
    case 'left':
      return {
        stackAxis: 'x',
        stackSign: 1,
        groundPos: -50,
        groundNormal: new THREE.Vector3(1, 0, 0),
        gridUAxis: 'y',
        gridVAxis: 'z',
        groundRotation: [0, Math.PI / 2, 0],
      };
    case 'right':
      return {
        stackAxis: 'x',
        stackSign: -1,
        groundPos: 50,
        groundNormal: new THREE.Vector3(-1, 0, 0),
        gridUAxis: 'y',
        gridVAxis: 'z',
        groundRotation: [0, -Math.PI / 2, 0],
      };
    case 'forward':
      return {
        stackAxis: 'z',
        stackSign: -1,
        groundPos: 50,
        groundNormal: new THREE.Vector3(0, 0, -1),
        gridUAxis: 'x',
        gridVAxis: 'y',
        groundRotation: [0, 0, 0],
      };
    case 'backward':
      return {
        stackAxis: 'z',
        stackSign: 1,
        groundPos: -50,
        groundNormal: new THREE.Vector3(0, 0, 1),
        gridUAxis: 'x',
        gridVAxis: 'y',
        groundRotation: [Math.PI, 0, 0],
      };
  }
}

function gridToWorld(
  gridU: number,
  gridV: number,
  heightLevel: number,
  info: BuildGravityInfo
): [number, number, number] {
  const stackOffset = info.groundPos + info.stackSign * (heightLevel * BLOCK_UNIT + HALF_BLOCK);
  const result: [number, number, number] = [0, 0, 0];

  result[0] = info.gridUAxis === 'x' ? gridU : info.gridVAxis === 'x' ? gridV : stackOffset;
  result[1] = info.gridUAxis === 'y' ? gridU : info.gridVAxis === 'y' ? gridV : stackOffset;
  result[2] = info.gridUAxis === 'z' ? gridU : info.gridVAxis === 'z' ? gridV : stackOffset;

  return result;
}

function worldToGrid(
  worldPos: THREE.Vector3 | [number, number, number],
  info: BuildGravityInfo
): { u: number; v: number; heightLevel: number } {
  const pos = Array.isArray(worldPos) ? worldPos : [worldPos.x, worldPos.y, worldPos.z];
  const uAxis = info.gridUAxis === 'x' ? 0 : info.gridUAxis === 'y' ? 1 : 2;
  const vAxis = info.gridVAxis === 'x' ? 0 : info.gridVAxis === 'y' ? 1 : 2;
  const sAxis = info.stackAxis === 'x' ? 0 : info.stackAxis === 'y' ? 1 : 2;

  const u = pos[uAxis];
  const v = pos[vAxis];
  const stackVal = pos[sAxis];
  const heightLevel = Math.max(0, Math.round(((stackVal - info.groundPos) * info.stackSign - HALF_BLOCK) / BLOCK_UNIT));

  return { u, v, heightLevel };
}

function getHeightPlane(heightLevel: number, info: BuildGravityInfo): THREE.Plane {
  const d = info.groundPos + info.stackSign * (heightLevel * BLOCK_UNIT + HALF_BLOCK);
  const normal = info.groundNormal.clone().negate();
  return new THREE.Plane(normal, -d);
}

function isStackNormal(normal: THREE.Vector3, info: BuildGravityInfo): boolean {
  const sAxis = info.stackAxis;
  const axisVal = sAxis === 'x' ? Math.abs(normal.x) : sAxis === 'y' ? Math.abs(normal.y) : Math.abs(normal.z);
  return axisVal > 0.5;
}

function getStackDirectionSign(normal: THREE.Vector3, info: BuildGravityInfo): number {
  const sAxis = info.stackAxis;
  const val = sAxis === 'x' ? normal.x : sAxis === 'y' ? normal.y : normal.z;
  return Math.sign(val);
}

function snapGridValue(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function getStackHeightFromGrid(
  gridU: number,
  gridV: number,
  info: BuildGravityInfo,
  excludeId?: string
): number {
  const blocks = useGameStore.getState().blocks;
  let maxStackHeight = 0;
  const sAxis = info.stackAxis;
  const uAxis = info.gridUAxis;
  const vAxis = info.gridVAxis;

  blocks.forEach((block, id) => {
    if (excludeId && id === excludeId) return;
    const bPos = block.position;
    const bSize = block.size;

    const bU = uAxis === 'x' ? bPos[0] : uAxis === 'y' ? bPos[1] : bPos[2];
    const bV = vAxis === 'x' ? bPos[0] : vAxis === 'y' ? bPos[1] : bPos[2];
    const bS = sAxis === 'x' ? bPos[0] : sAxis === 'y' ? bPos[1] : bPos[2];
    const bHalfS = (sAxis === 'x' ? bSize[0] : sAxis === 'y' ? bSize[1] : bSize[2]) / 2;
    const bHalfU = (uAxis === 'x' ? bSize[0] : uAxis === 'y' ? bSize[1] : bSize[2]) / 2;
    const bHalfV = (vAxis === 'x' ? bSize[0] : vAxis === 'y' ? bSize[1] : vAxis === 'z' ? bSize[2] : bSize[2]) / 2;

    if (Math.abs(bU - gridU) < bHalfU + 0.25 && Math.abs(bV - gridV) < bHalfV + 0.25) {
      const blockStackTop = (bS - info.groundPos) * info.stackSign + bHalfS;
      if (blockStackTop > maxStackHeight) {
        maxStackHeight = blockStackTop;
      }
    }
  });

  return maxStackHeight + HALF_BLOCK;
}

function gridToStackWorld(gridU: number, gridV: number, stackHeight: number, info: BuildGravityInfo): [number, number, number] {
  const stackVal = info.groundPos + info.stackSign * stackHeight;
  const result: [number, number, number] = [0, 0, 0];
  result[0] = info.gridUAxis === 'x' ? gridU : info.gridVAxis === 'x' ? gridV : stackVal;
  result[1] = info.gridUAxis === 'y' ? gridU : info.gridVAxis === 'y' ? gridV : stackVal;
  result[2] = info.gridUAxis === 'z' ? gridU : info.gridVAxis === 'z' ? gridV : stackVal;
  return result;
}

interface BuildHeightState {
  heightLevel: number;
  setHeightLevel: (level: number) => void;
  incHeight: () => void;
  decHeight: () => void;
}

const useBuildHeightLevel = create<BuildHeightState>((set, get) => ({
  heightLevel: 0,
  setHeightLevel: (level) => set({ heightLevel: Math.max(0, Math.min(MAX_HEIGHT_LEVEL, level)) }),
  incHeight: () => set({ heightLevel: Math.min(MAX_HEIGHT_LEVEL, get().heightLevel + 1) }),
  decHeight: () => set({ heightLevel: Math.max(0, get().heightLevel - 1) }),
}));

function BuildGrid() {
  const linesRef = useRef<THREE.Group>(null);
  const buildTool = useGameStore((s) => s.buildTool);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const info = getBuildGravityInfo(gravityDirection);

  useEffect(() => {
    if (!linesRef.current) return;
    const group = linesRef.current;
    const material = new THREE.LineBasicMaterial({
      color: '#4a5568',
      transparent: true,
      opacity: 0.3,
    });

    for (let i = -GRID_HALF; i <= GRID_HALF; i += GRID_SIZE) {
      const p1a = gridToWorld(i, -GRID_HALF, 0, info);
      const p1b = gridToWorld(i, GRID_HALF, 0, info);
      const points1 = [new THREE.Vector3(...p1a), new THREE.Vector3(...p1b)];
      const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
      group.add(new THREE.Line(geo1, material));

      const p2a = gridToWorld(-GRID_HALF, i, 0, info);
      const p2b = gridToWorld(GRID_HALF, i, 0, info);
      const points2 = [new THREE.Vector3(...p2a), new THREE.Vector3(...p2b)];
      const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
      group.add(new THREE.Line(geo2, material));
    }

    return () => {
      while (group.children.length > 0) {
        const child = group.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
        }
        group.remove(child);
      }
    };
  }, [gravityDirection, info]);

  const levelPos = gridToWorld(0, 0, heightLevel, info);
  const gridOffset = info.groundNormal.clone().multiplyScalar(-0.01);
  const adjustedLevelPos: [number, number, number] = [
    levelPos[0] + gridOffset.x,
    levelPos[1] + gridOffset.y,
    levelPos[2] + gridOffset.z,
  ];

  return (
    <>
      <group ref={linesRef} />
      {(buildTool === 'place' || buildTool === 'move') && heightLevel > 0 && (
        <group position={adjustedLevelPos} rotation={info.groundRotation}>
          <gridHelper args={[GRID_HALF * 2, GRID_HALF * 2, 0x4a5568, 0x4a5568]} />
        </group>
      )}
    </>
  );
}

function GhostBlock() {
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const buildTool = useGameStore((s) => s.buildTool);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const [ghostPos, setGhostPos] = useState<[number, number, number] | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const { camera, raycaster, pointer, scene } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastHeight = useRef(0);
  const lastGravity = useRef<GravityDirection>('down');
  const heightPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  useFrame(() => {
    if (buildTool !== 'place') {
      setGhostPos(null);
      setIsColliding(false);
      return;
    }

    const info = getBuildGravityInfo(gravityDirection);

    const pointerMoved = Math.abs(pointer.x - lastPointer.current.x) > 0.001 || Math.abs(pointer.y - lastPointer.current.y) > 0.001;
    const heightChanged = heightLevel !== lastHeight.current;
    const gravityChanged = gravityDirection !== lastGravity.current;

    if (!pointerMoved && !heightChanged && !gravityChanged) {
      return;
    }
    lastPointer.current = { x: pointer.x, y: pointer.y };
    lastHeight.current = heightLevel;
    lastGravity.current = gravityDirection;

    raycaster.setFromCamera(pointer, camera);

    const buildMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData?.isBuildBlock) {
        buildMeshes.push(obj);
      }
    });

    const hits = raycaster.intersectObjects(buildMeshes, false);
    let hitPoint: THREE.Vector3 | null = null;
    let hitFaceNormal: THREE.Vector3 | null = null;

    if (hits.length > 0) {
      hitPoint = hits[0].point;
      hitFaceNormal = hits[0].face?.normal?.clone() || null;
      if (hitFaceNormal) {
        hitFaceNormal.transformDirection(hits[0].object.matrixWorld);
      }
    }

    let newPos: [number, number, number] | null = null;

    if (hitPoint && hitFaceNormal) {
      const gridPos = worldToGrid(hitPoint, info);
      const snappedU = snapGridValue(gridPos.u);
      const snappedV = snapGridValue(gridPos.v);

      if (isStackNormal(hitFaceNormal, info)) {
        const dirSign = getStackDirectionSign(hitFaceNormal, info);
        if (dirSign * info.stackSign > 0) {
          const stackHeight = getStackHeightFromGrid(snappedU, snappedV, info);
          newPos = gridToStackWorld(snappedU, snappedV, stackHeight, info);
        } else {
          const currentStackHeight = gridPos.heightLevel * BLOCK_UNIT + HALF_BLOCK;
          const belowStackHeight = Math.max(HALF_BLOCK, currentStackHeight - BLOCK_UNIT);
          newPos = gridToStackWorld(snappedU, snappedV, belowStackHeight, info);
        }
      } else {
        const uAxis = info.gridUAxis === 'x' ? 0 : info.gridUAxis === 'y' ? 1 : 2;
        const vAxis = info.gridVAxis === 'x' ? 0 : info.gridVAxis === 'y' ? 1 : 2;

        const normalU = (uAxis === 0 ? hitFaceNormal.x : uAxis === 1 ? hitFaceNormal.y : hitFaceNormal.z);
        const normalV = (vAxis === 0 ? hitFaceNormal.x : vAxis === 1 ? hitFaceNormal.y : hitFaceNormal.z);

        const offsetU = Math.abs(normalU) > 0.5 ? Math.sign(normalU) * GRID_SIZE : 0;
        const offsetV = Math.abs(normalV) > 0.5 ? Math.sign(normalV) * GRID_SIZE : 0;

        const targetU = snappedU + offsetU;
        const targetV = snappedV + offsetV;
        const stackHeight = getStackHeightFromGrid(targetU, targetV, info);
        newPos = gridToStackWorld(targetU, targetV, stackHeight, info);
      }
    } else {
      heightPlane.current = getHeightPlane(heightLevel, info);
      if (raycaster.ray.intersectPlane(heightPlane.current, intersectionPoint.current)) {
        const gridPos = worldToGrid(intersectionPoint.current, info);
        const snappedU = snapGridValue(gridPos.u);
        const snappedV = snapGridValue(gridPos.v);
        const gridStackHeight = heightLevel * BLOCK_UNIT + HALF_BLOCK;
        const worldPos = gridToStackWorld(snappedU, snappedV, gridStackHeight, info);

        const actualStackHeight = getStackHeightFromGrid(snappedU, snappedV, info);
        const finalStackHeight = heightLevel > 0
          ? Math.max(actualStackHeight, heightLevel * BLOCK_UNIT + HALF_BLOCK)
          : actualStackHeight;

        newPos = gridToStackWorld(snappedU, snappedV, finalStackHeight, info);
        void worldPos;
      }
    }

    if (newPos) {
      const colliding = checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT]);
      setGhostPos(newPos);
      setIsColliding(colliding);
    } else {
      setGhostPos(null);
      setIsColliding(false);
    }
  });

  const properties = materialProperties[buildMaterial];
  const isGlass = buildMaterial === 'glass';

  if (!ghostPos) return null;

  const displayColor = isColliding ? '#ff3333' : properties.color;
  const edgeColor = isColliding ? '#ff6666' : '#ffffff';

  return (
    <mesh position={ghostPos}>
      <boxGeometry args={[BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT]} />
      <meshStandardMaterial
        color={displayColor}
        transparent
        opacity={isGlass ? 0.3 : 0.4}
        roughness={0.5}
        depthWrite={false}
        emissive={isColliding ? '#ff0000' : '#000000'}
        emissiveIntensity={isColliding ? 0.3 : 0}
      />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT)]} />
        <lineBasicMaterial color={edgeColor} transparent opacity={0.8} />
      </lineSegments>
    </mesh>
  );
}

function checkCollision(position: [number, number, number], size: [number, number, number], excludeId?: string): boolean {
  const blocks = useGameStore.getState().blocks;
  const [px, py, pz] = position;
  const halfW = size[0] / 2;
  const halfH = size[1] / 2;
  const halfD = size[2] / 2;

  for (const [id, block] of blocks.entries()) {
    if (excludeId && id === excludeId) continue;
    const [bx, by, bz] = block.position;
    const bHalfW = block.size[0] / 2;
    const bHalfH = block.size[1] / 2;
    const bHalfD = block.size[2] / 2;

    if (
      Math.abs(bx - px) < halfW + bHalfW - 0.001 &&
      Math.abs(by - py) < halfH + bHalfH - 0.001 &&
      Math.abs(bz - pz) < halfD + bHalfD - 0.001
    ) {
      return true;
    }
  }

  return false;
}

function BuildBlock({ block, isSelected }: { block: BlockData; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasTexture, setCanvasTexture] = useState<THREE.CanvasTexture | null>(null);
  const lastSprayVersion = useRef(0);
  const outlineRef = useRef<THREE.LineSegments>(null);
  const buildTool = useGameStore((s) => s.buildTool);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const addBlock = useGameStore((s) => s.addBlock);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const properties = materialProperties[block.material];
  const isGlass = block.material === 'glass';
  const rotation = block.rotation || [0, 0, 0];
  const isDragMoving = useRef(false);
  const dragStart = useRef<[number, number, number] | null>(null);
  const movePlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -block.position[1]));
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastHeightLevel = useRef(0);
  const dragBaseU = useRef(0);
  const dragBaseV = useRef(0);
  const { camera, raycaster, pointer } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);
  const getBlockSprayCanvas = useGameStore((s) => s.getBlockSprayCanvas);
  const blockData = useGameStore((s) => s.blocks.get(block.id));

  const updateBlockTexture = useCallback(() => {
    if (!baseCanvasRef.current || !textureRef.current) return;
    const baseCtx = baseCanvasRef.current.getContext('2d');
    if (!baseCtx) return;

    const props = materialProperties[block.material];
    const w = baseCanvasRef.current.width;
    const h = baseCanvasRef.current.height;
    baseCtx.clearRect(0, 0, w, h);
    baseCtx.fillStyle = props.color;
    baseCtx.fillRect(0, 0, w, h);

    const sprayCanvas = getBlockSprayCanvas(block.id);
    if (sprayCanvas) {
      baseCtx.drawImage(sprayCanvas, 0, 0, w, h);
    }
    textureRef.current.needsUpdate = true;
    if (materialRef.current) {
      materialRef.current.needsUpdate = true;
    }
  }, [block.id, block.material, getBlockSprayCanvas]);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    baseCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const props = materialProperties[block.material];
      ctx.fillStyle = props.color;
      ctx.fillRect(0, 0, 256, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    textureRef.current = texture;
    setCanvasTexture(texture);

    updateBlockTexture();

    return () => {
      texture.dispose();
      textureRef.current = null;
      setCanvasTexture(null);
    };
  }, [block.material, updateBlockTexture]);

  useFrame(() => {
    const currentSprayVersion = blockData?.sprayTextureVersion || 0;
    if (currentSprayVersion !== lastSprayVersion.current) {
      lastSprayVersion.current = currentSprayVersion;
      updateBlockTexture();
    }
  });

  const placeOnTop = useCallback(() => {
    const info = getBuildGravityInfo(gravityDirection);
    const gridPos = worldToGrid(block.position, info);
    const snappedU = snapGridValue(gridPos.u);
    const snappedV = snapGridValue(gridPos.v);
    const stackHeight = getStackHeightFromGrid(snappedU, snappedV, info);
    const newPos = gridToStackWorld(snappedU, snappedV, stackHeight, info);
    if (checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;
    const props = materialProperties[buildMaterial];
    const newBlock: BlockData = {
      id: generateId(),
      position: newPos,
      size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
      material: buildMaterial,
      health: props.health,
      maxHealth: props.health,
      rotation: [0, 0, 0],
    };
    addBlock(newBlock);
    pushUndoAction({ type: 'add', block: { ...newBlock } });
  }, [block.position, block.size, buildMaterial, addBlock, pushUndoAction, gravityDirection]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (buildTool === 'place') {
      const hit = e.intersections[0];
      if (hit?.face?.normal) {
        const normal = hit.face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);
        const info = getBuildGravityInfo(gravityDirection);
        const gridPos = worldToGrid(block.position, info);
        const snappedU = snapGridValue(gridPos.u);
        const snappedV = snapGridValue(gridPos.v);
        const props = materialProperties[buildMaterial];

        let placePos: [number, number, number] | null = null;

        if (isStackNormal(normal, info)) {
          const dirSign = getStackDirectionSign(normal, info);
          if (dirSign * info.stackSign > 0) {
            const stackHeight = getStackHeightFromGrid(snappedU, snappedV, info);
            placePos = gridToStackWorld(snappedU, snappedV, stackHeight, info);
          } else {
            const stackBelow = getStackHeightFromGrid(snappedU, snappedV, info, block.id);
            const belowStackHeight = Math.max(HALF_BLOCK, stackBelow - BLOCK_UNIT);
            placePos = gridToStackWorld(snappedU, snappedV, belowStackHeight, info);
          }
        } else {
          const uAxis = info.gridUAxis === 'x' ? 0 : info.gridUAxis === 'y' ? 1 : 2;
          const vAxis = info.gridVAxis === 'x' ? 0 : info.gridVAxis === 'y' ? 1 : 2;
          const normalU = (uAxis === 0 ? normal.x : uAxis === 1 ? normal.y : normal.z);
          const normalV = (vAxis === 0 ? normal.x : vAxis === 1 ? normal.y : normal.z);
          const offsetU = Math.abs(normalU) > 0.5 ? Math.sign(normalU) * GRID_SIZE : 0;
          const offsetV = Math.abs(normalV) > 0.5 ? Math.sign(normalV) * GRID_SIZE : 0;
          const targetU = snappedU + offsetU;
          const targetV = snappedV + offsetV;
          const stackHeight = getStackHeightFromGrid(targetU, targetV, info);
          placePos = gridToStackWorld(targetU, targetV, stackHeight, info);
        }

        if (!placePos || checkCollision(placePos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;

        const newBlock: BlockData = {
          id: generateId(),
          position: placePos,
          size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
          material: buildMaterial,
          health: props.health,
          maxHealth: props.health,
          rotation: [0, 0, 0],
        };
        addBlock(newBlock);
        pushUndoAction({ type: 'add', block: { ...newBlock } });
      } else {
        placeOnTop();
      }
      return;
    }
    if (buildTool === 'delete') {
      const blockMap = useGameStore.getState().blocks;
      const blockData = blockMap.get(block.id);
      if (blockData) {
        useGameStore.getState().removeBlock(block.id);
        pushUndoAction({ type: 'remove', block: { ...blockData } });
      }
      return;
    }
    if (buildTool === 'move' || buildTool === 'rotate') {
      setSelectedBlockId(isSelected ? null : block.id);
      return;
    }
    setSelectedBlockId(block.id);
  }, [block.id, block.position, block.size, buildTool, buildMaterial, isSelected, setSelectedBlockId, pushUndoAction, addBlock, placeOnTop, gravityDirection]);

  const setHeightLevel = useBuildHeightLevel((s) => s.setHeightLevel);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (buildTool !== 'move' || !isSelected) return;
    e.stopPropagation();
    isDragMoving.current = true;
    dragStart.current = [...block.position] as [number, number, number];
    const info = getBuildGravityInfo(gravityDirection);
    const gridPos = worldToGrid(block.position, info);
    const currentBlockLevel = Math.max(0, gridPos.heightLevel);
    setHeightLevel(currentBlockLevel);
    movePlaneRef.current = getHeightPlane(currentBlockLevel, info);
    lastPointer.current = { x: pointer.x, y: pointer.y };
    lastHeightLevel.current = currentBlockLevel;
    dragBaseU.current = snapGridValue(gridPos.u);
    dragBaseV.current = snapGridValue(gridPos.v);
  }, [buildTool, isSelected, block.position, setHeightLevel, pointer, gravityDirection]);

  const handlePointerUp = useCallback(() => {
    if (!isDragMoving.current || !dragStart.current) return;
    isDragMoving.current = false;
    const fromPos = dragStart.current;
    const toPos = [...block.position] as [number, number, number];
    if (fromPos[0] !== toPos[0] || fromPos[1] !== toPos[1] || fromPos[2] !== toPos[2]) {
      pushUndoAction({
        type: 'move',
        blockId: block.id,
        fromPosition: fromPos,
        toPosition: toPos,
      });
    }
    dragStart.current = null;
  }, [block.id, block.position, pushUndoAction]);

  useFrame(() => {
    if (isDragMoving.current && buildTool === 'move' && isSelected) {
      const info = getBuildGravityInfo(gravityDirection);
      const pointerMoved = Math.abs(pointer.x - lastPointer.current.x) > 0.001 || Math.abs(pointer.y - lastPointer.current.y) > 0.001;
      const heightChanged = heightLevel !== lastHeightLevel.current;

      if (pointerMoved) {
        raycaster.setFromCamera(pointer, camera);
        const ray = raycaster.ray;
        movePlaneRef.current = getHeightPlane(heightLevel, info);
        if (ray.intersectPlane(movePlaneRef.current, intersectionPoint.current)) {
          const gridPos = worldToGrid(intersectionPoint.current, info);
          const snappedU = snapGridValue(gridPos.u);
          const snappedV = snapGridValue(gridPos.v);
          const newPos = gridToStackWorld(snappedU, snappedV, heightLevel * BLOCK_UNIT + HALF_BLOCK, info);
          if (
            newPos[0] !== block.position[0] ||
            Math.abs(newPos[1] - block.position[1]) > 0.001 ||
            newPos[2] !== block.position[2]
          ) {
            if (!checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT], block.id)) {
              updateBlockPosition(block.id, newPos);
              dragBaseU.current = snappedU;
              dragBaseV.current = snappedV;
            }
          }
        }
        lastPointer.current = { x: pointer.x, y: pointer.y };
      } else if (heightChanged) {
        const newPos = gridToStackWorld(dragBaseU.current, dragBaseV.current, heightLevel * BLOCK_UNIT + HALF_BLOCK, info);
        if (
          Math.abs(newPos[1] - block.position[1]) > 0.001 ||
          newPos[0] !== block.position[0] ||
          newPos[2] !== block.position[2]
        ) {
          if (!checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT], block.id)) {
            updateBlockPosition(block.id, newPos);
          }
        }
      }

      lastHeightLevel.current = heightLevel;
    }
  });

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragMoving.current) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [handlePointerUp]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={block.position}
        rotation={rotation}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        userData={{ isBuildBlock: true, blockId: block.id, blockMaterial: block.material, blockSize: block.size }}
      >
        <boxGeometry args={block.size} />
        <meshStandardMaterial
          ref={materialRef}
          color="#ffffff"
          map={canvasTexture}
          transparent={isGlass}
          opacity={isGlass ? 0.6 : 1}
          roughness={block.material === 'wood' ? 0.8 : block.material === 'concrete' ? 0.9 : 0.1}
          metalness={block.material === 'concrete' ? 0.1 : block.material === 'glass' ? 0.9 : 0.05}
          emissive={properties.color}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {isSelected && (
        <lineSegments
          ref={outlineRef}
          position={block.position}
          rotation={rotation}
        >
          <edgesGeometry args={[new THREE.BoxGeometry(block.size[0] * 1.02, block.size[1] * 1.02, block.size[2] * 1.02)]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      )}
    </group>
  );
}

function PlacementHandler() {
  const buildTool = useGameStore((s) => s.buildTool);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const addBlock = useGameStore((s) => s.addBlock);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const { camera, raycaster, pointer } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (buildTool !== 'place') return;
    e.stopPropagation();

    const info = getBuildGravityInfo(gravityDirection);
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;

    const plane = getHeightPlane(heightLevel, info);

    if (ray.intersectPlane(plane, intersectionPoint.current)) {
      const gridPos = worldToGrid(intersectionPoint.current, info);
      const snappedU = snapGridValue(gridPos.u);
      const snappedV = snapGridValue(gridPos.v);
      const actualStackHeight = getStackHeightFromGrid(snappedU, snappedV, info);
      const finalStackHeight = heightLevel > 0
        ? Math.max(actualStackHeight, heightLevel * BLOCK_UNIT + HALF_BLOCK)
        : actualStackHeight;
      const finalPos = gridToStackWorld(snappedU, snappedV, finalStackHeight, info);

      if (checkCollision(finalPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;

      const properties = materialProperties[buildMaterial];
      const placedBlock: BlockData = {
        id: generateId(),
        position: finalPos,
        size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
        material: buildMaterial,
        health: properties.health,
        maxHealth: properties.health,
        rotation: [0, 0, 0],
      };

      addBlock(placedBlock);
      pushUndoAction({ type: 'add', block: { ...placedBlock } });
    }
  }, [buildTool, buildMaterial, addBlock, pushUndoAction, camera, raycaster, pointer, heightLevel, gravityDirection]);

  const info = getBuildGravityInfo(gravityDirection);
  const groundPos = gridToWorld(0, 0, 0, info);
  const clickOffset = info.groundNormal.clone().multiplyScalar(-0.1);
  const clickPos: [number, number, number] = [
    groundPos[0] + clickOffset.x,
    groundPos[1] + clickOffset.y,
    groundPos[2] + clickOffset.z,
  ];

  return (
    <mesh
      rotation={info.groundRotation}
      position={clickPos}
      onClick={handleGroundClick}
    >
      <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function KeyboardHandler() {
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const blocks = useGameStore((s) => s.blocks);
  const buildTool = useGameStore((s) => s.buildTool);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const removeBlock = useGameStore((s) => s.removeBlock);
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);
  const incHeight = useBuildHeightLevel((s) => s.incHeight);
  const decHeight = useBuildHeightLevel((s) => s.decHeight);
  const setHeightLevel = useBuildHeightLevel((s) => s.setHeightLevel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }

      if (buildTool === 'place' || buildTool === 'move') {
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          incHeight();
          return;
        }
        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          decHeight();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setHeightLevel(0);
          return;
        }
      }

      if (!selectedBlockId) return;
      const block = blocks.get(selectedBlockId);
      if (!block) return;

      if (e.key === 'r' || e.key === 'R') {
        const currentRot = block.rotation || [0, 0, 0];
        const newRot: [number, number, number] = [currentRot[0], currentRot[1] + ROTATION_STEP, currentRot[2]];
        const fromRotation = [...currentRot] as [number, number, number];
        updateBlockRotation(selectedBlockId, newRot);
        pushUndoAction({ type: 'rotate', blockId: selectedBlockId, fromRotation, toRotation: newRot });
      }

      if (buildTool === 'move') {
        const info = getBuildGravityInfo(gravityDirection);
        const gridPos = worldToGrid(block.position, info);
        const fromPos = [...block.position] as [number, number, number];
        let moved = false;
        let newU = gridPos.u;
        let newV = gridPos.v;
        let newHeight = gridPos.heightLevel;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          newV -= GRID_SIZE;
          moved = true;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          newV += GRID_SIZE;
          moved = true;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          newU -= GRID_SIZE;
          moved = true;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          newU += GRID_SIZE;
          moved = true;
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          newHeight = Math.min(MAX_HEIGHT_LEVEL, newHeight + 1);
          moved = true;
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          newHeight = Math.max(0, newHeight - 1);
          moved = true;
        }

        if (moved) {
          newU = Math.max(-GRID_HALF, Math.min(GRID_HALF, newU));
          newV = Math.max(-GRID_HALF, Math.min(GRID_HALF, newV));
          const toPos = gridToStackWorld(newU, newV, newHeight * BLOCK_UNIT + HALF_BLOCK, info);
          if (!checkCollision(toPos, block.size, selectedBlockId)) {
            updateBlockPosition(selectedBlockId, toPos);
            pushUndoAction({ type: 'move', blockId: selectedBlockId, fromPosition: fromPos, toPosition: toPos });
          }
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const blockData = blocks.get(selectedBlockId);
        if (blockData) {
          removeBlock(selectedBlockId);
          pushUndoAction({ type: 'remove', block: { ...blockData } });
          setSelectedBlockId(null);
        }
      }

      if (e.key === 'Escape') {
        setSelectedBlockId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, blocks, buildTool, gravityDirection, updateBlockRotation, pushUndoAction, undo, redo, removeBlock, setSelectedBlockId, updateBlockPosition, incHeight, decHeight, setHeightLevel]);

  return null;
}

function BuildGround() {
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const info = getBuildGravityInfo(gravityDirection);
  const groundPos = gridToWorld(0, 0, 0, info);
  const circleOffset = info.groundNormal.clone().multiplyScalar(-0.005).toArray() as [number, number, number];
  const circlePos: [number, number, number] = [
    groundPos[0] + circleOffset[0],
    groundPos[1] + circleOffset[1],
    groundPos[2] + circleOffset[2],
  ];

  return (
    <>
      <mesh rotation={info.groundRotation} position={groundPos} receiveShadow>
        <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
        <meshStandardMaterial color="#2a3a2a" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh rotation={info.groundRotation} position={circlePos}>
        <circleGeometry args={[GRID_HALF * 0.8, 64]} />
        <meshStandardMaterial color="#3a4a3a" roughness={0.8} metalness={0.1} />
      </mesh>
    </>
  );
}

export function BuildMode() {
  const blocks = useGameStore((s) => s.blocks);
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const buildTool = useGameStore((s) => s.buildTool);

  const blockArray = Array.from(blocks.values());

  return (
    <>
      <BuildGround />
      <BuildGrid />
      <GhostBlock />
      <PlacementHandler />
      <KeyboardHandler />

      {blockArray.map((block) => (
        <BuildBlock
          key={block.id}
          block={block}
          isSelected={block.id === selectedBlockId}
        />
      ))}

      {selectedBlockId && buildTool === 'rotate' && (
        <RotateGizmo blockId={selectedBlockId} />
      )}

      <HeightLevelIndicator />
    </>
  );
}

function HeightLevelIndicator() {
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const buildTool = useGameStore((s) => s.buildTool);
  const gravityDirection = useGameStore((s) => s.gravityDirection);

  if (buildTool !== 'place' && buildTool !== 'move') return null;

  const info = getBuildGravityInfo(gravityDirection);
  const pos = gridToWorld(-GRID_HALF + 1, -GRID_HALF + 1, heightLevel, info);

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={heightLevel === 0 ? '#88ff88' : '#ffaa44'}
          emissive={heightLevel === 0 ? '#00ff00' : '#ff6600'}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

function RotateGizmo({ blockId }: { blockId: string }) {
  const blocks = useGameStore((s) => s.blocks);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const block = blocks.get(blockId);
  const [hovered, setHovered] = useState<string | null>(null);

  if (!block) return null;

  const position = block.position;
  const currentRot = block.rotation || [0, 0, 0];

  const arrows = [
    { axis: 'y+', color: '#00ff88', rotation: [0, 0, -Math.PI / 2] as [number, number, number], offset: [0, 0, 1.2] as [number, number, number] },
    { axis: 'y-', color: '#ff8800', rotation: [0, 0, Math.PI / 2] as [number, number, number], offset: [0, 0, -1.2] as [number, number, number] },
    { axis: 'x+', color: '#0088ff', rotation: [0, Math.PI / 2, 0] as [number, number, number], offset: [1.2, 0, 0] as [number, number, number] },
    { axis: 'x-', color: '#ff0088', rotation: [0, -Math.PI / 2, 0] as [number, number, number], offset: [-1.2, 0, 0] as [number, number, number] },
  ];

  const handleRotate = (axis: string) => {
    const fromRotation = [...currentRot] as [number, number, number];
    const newRot: [number, number, number] = [...currentRot] as [number, number, number];

    if (axis === 'y+' || axis === 'y-') {
      newRot[1] += axis === 'y+' ? ROTATION_STEP : -ROTATION_STEP;
    } else if (axis === 'x+' || axis === 'x-') {
      newRot[0] += axis === 'x+' ? ROTATION_STEP : -ROTATION_STEP;
    }

    updateBlockRotation(blockId, newRot);
    pushUndoAction({ type: 'rotate', blockId, fromRotation, toRotation: newRot });
  };

  return (
    <group position={position}>
      {arrows.map((arrow) => (
        <group
          key={arrow.axis}
          position={arrow.offset}
          rotation={arrow.rotation}
          onClick={(e) => {
            e.stopPropagation();
            handleRotate(arrow.axis);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(arrow.axis);
          }}
          onPointerOut={() => setHovered(null)}
        >
          <mesh>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshStandardMaterial
              color={hovered === arrow.axis ? '#ffffff' : arrow.color}
              emissive={arrow.color}
              emissiveIntensity={hovered === arrow.axis ? 1 : 0.3}
            />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial
              color={arrow.color}
              emissive={arrow.color}
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default BuildMode;
