import { create } from 'zustand';
import * as CANNON from 'cannon-es';
import { World } from '@/ecs/core';
import { ComponentType } from '@/ecs/components';
import * as BlockSystem from '@/ecs/systems/block';
import * as ParticleSystem from '@/ecs/systems/particle';
import * as ExplosionSystem from '@/ecs/systems/explosion';
import * as WeaponSystem from '@/ecs/systems/weapon';
import * as AudioSystem from '@/ecs/systems/audio';
import * as BuildSystem from '@/ecs/systems/build';
import * as PhysicsLabSystem from '@/ecs/systems/physicsLab';
import * as RoboticArmSystem from '@/ecs/systems/roboticArm';
import * as BlueprintSystem from '@/ecs/systems/blueprint';
import { clampSpraySize } from '@/lib/physicsUtils';

export type WeaponType = 'wreckingBall' | 'steelBall' | 'explosive' | 'sprayPaint';

export type WeaponUpgradeKey = 'damage' | 'speed' | 'radius';

export interface WeaponUpgradeLevels {
  damage: number;
  speed: number;
  radius: number;
}

export type WeaponAppearanceKey = 'mainColor' | 'trailColor' | 'glowColor' | 'effectType';

export type WeaponEffectType = 'none' | 'fire' | 'electric' | 'rainbow' | 'shadow';

export interface WeaponAppearance {
  mainColor: string;
  trailColor: string;
  glowColor: string;
  effectType: WeaponEffectType;
}

export type WeaponCustomizations = Record<WeaponType, {
  upgrades: WeaponUpgradeLevels;
  appearance: WeaponAppearance;
}>;
export type MaterialType = 'wood' | 'glass' | 'concrete';
export type GameMode = 'destroy' | 'build' | 'roboticArm' | 'physicsLab';
export type BuildTool = 'place' | 'move' | 'rotate' | 'delete' | 'sprayPaint';
export type GravityDirection = 'down' | 'up' | 'left' | 'right' | 'forward' | 'backward';
export type ConstraintType = 'spring' | 'rope' | 'hinge' | 'pulley' | 'distance';
export type LabObjectType = 'box' | 'sphere' | 'cylinder' | 'groundAnchor' | 'weight';
export type LabTool = 'placeObject' | 'placeConstraint' | 'select' | 'delete' | 'move';

export const GRAVITY_VECTORS: Record<GravityDirection, [number, number, number]> = {
  down: [0, -30, 0],
  up: [0, 30, 0],
  left: [-30, 0, 0],
  right: [30, 0, 0],
  forward: [0, 0, 30],
  backward: [0, 0, -30],
};

export const GRAVITY_LABELS: Record<GravityDirection, string> = {
  down: '↓ 向下',
  up: '↑ 向上',
  left: '← 向左',
  right: '→ 向右',
  forward: '⦿ 向前',
  backward: '⊗ 向后',
};

export interface SprayPoint {
  x: number;
  y: number;
  face: string;
  color: string;
  size: number;
}

export interface BlockSprayData {
  blockId: string;
  points: SprayPoint[];
}

export interface AudioAnalysisData {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  spectrum: Float32Array;
  beatDetected: boolean;
}

export interface AudioEffectsConfig {
  shakeIntensity: number;
  glowIntensity: number;
  collapseThreshold: number;
  enableCollapse: boolean;
  colorMode: 'frequency' | 'rainbow' | 'material' | 'pulse';
}

export interface BlueprintData {
  id: string;
  name: string;
  blocks: { position: [number, number, number]; size: [number, number, number]; material: MaterialType; rotation?: [number, number, number] }[];
  gravityDirection: GravityDirection;
  createdAt: number;
}

export interface BlockData {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  material: MaterialType;
  health: number;
  maxHealth: number;
  rotation?: [number, number, number];
  sprayCanvas?: HTMLCanvasElement | null;
  sprayTextureVersion?: number;
}

export interface ParticleData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ExplosionData {
  id: string;
  position: [number, number, number];
  radius: number;
  life: number;
  maxLife: number;
}

export type BuildAction =
  | { type: 'add'; block: BlockData }
  | { type: 'remove'; block: BlockData }
  | { type: 'move'; blockId: string; fromPosition: [number, number, number]; toPosition: [number, number, number] }
  | { type: 'rotate'; blockId: string; fromRotation: [number, number, number]; toRotation: [number, number, number] };

export interface RoboticArmState {
  baseAngle: number;
  shoulderAngle: number;
  elbowAngle: number;
  wristAngle: number;
  gripperOpen: boolean;
  isGrabbing: boolean;
  grabbedBlockId: string | null;
}

export interface LabObjectData {
  id: string;
  type: LabObjectType;
  position: [number, number, number];
  size?: [number, number, number];
  radius?: number;
  height?: number;
  mass: number;
  color: string;
  isStatic: boolean;
  rotation?: [number, number, number];
}

export interface LabConstraintData {
  id: string;
  type: ConstraintType;
  bodyAId: string;
  bodyBId: string;
  pivotA?: [number, number, number];
  pivotB?: [number, number, number];
  axisA?: [number, number, number];
  axisB?: [number, number, number];
  restLength?: number;
  stiffness?: number;
  damping?: number;
  maxForce?: number;
  angle?: number;
}

interface GameState {
  weapon: WeaponType;
  setWeapon: (weapon: WeaponType) => void;
  weaponCustomizations: WeaponCustomizations;
  upgradeWeapon: (weapon: WeaponType, key: WeaponUpgradeKey) => void;
  setWeaponAppearance: (weapon: WeaponType, key: WeaponAppearanceKey, value: string) => void;
  getWeaponUpgrade: (weapon: WeaponType, key: WeaponUpgradeKey) => number;
  getWeaponUpgradeMultiplier: (weapon: WeaponType, key: WeaponUpgradeKey) => number;
  getWeaponAppearance: (weapon: WeaponType) => WeaponAppearance;
  resetWeaponCustomizations: () => void;
  blocks: Map<string, BlockData>;
  addBlock: (block: BlockData) => void;
  addBlocks: (blocks: BlockData[]) => void;
  removeBlock: (id: string) => void;
  damageBlock: (id: string, damage: number) => boolean;
  updateBlockPosition: (id: string, position: [number, number, number]) => void;
  updateBlockRotation: (id: string, rotation: [number, number, number]) => void;
  sprayColor: string;
  setSprayColor: (color: string) => void;
  spraySize: number;
  setSpraySize: (size: number) => void;
  addSprayPoint: (blockId: string, point: SprayPoint) => void;
  getBlockSprayCanvas: (blockId: string) => HTMLCanvasElement | null;
  getBlockSprayPoints: (blockId: string) => SprayPoint[];
  particles: Map<string, ParticleData>;
  addParticle: (particle: ParticleData) => void;
  removeParticle: (id: string) => void;
  updateParticle: (id: string, data: Partial<ParticleData>) => void;
  explosions: Map<string, ExplosionData>;
  addExplosion: (explosion: ExplosionData) => void;
  removeExplosion: (id: string) => void;
  updateExplosion: (id: string, data: Partial<ExplosionData>) => void;
  wreckingBallActive: boolean;
  setWreckingBallActive: (active: boolean) => void;
  resetGame: () => void;
  world: CANNON.World | null;
  setWorld: (world: CANNON.World) => void;
  shootCooldown: boolean;
  setShootCooldown: (cooldown: boolean) => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  buildMaterial: MaterialType;
  setBuildMaterial: (material: MaterialType) => void;
  buildTool: BuildTool;
  setBuildTool: (tool: BuildTool) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  undoStack: BuildAction[];
  redoStack: BuildAction[];
  pushUndoAction: (action: BuildAction) => void;
  undo: () => void;
  redo: () => void;
  clearBuildState: () => void;
  audioAnalysis: AudioAnalysisData;
  setAudioAnalysis: (analysis: AudioAnalysisData) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioEffectsConfig: AudioEffectsConfig;
  updateAudioEffectsConfig: (config: Partial<AudioEffectsConfig>) => void;
  gravityDirection: GravityDirection;
  setGravityDirection: (direction: GravityDirection) => void;
  roboticArm: RoboticArmState;
  setRoboticArmBaseAngle: (angle: number) => void;
  setRoboticArmShoulderAngle: (angle: number) => void;
  setRoboticArmElbowAngle: (angle: number) => void;
  setRoboticArmWristAngle: (angle: number) => void;
  setRoboticArmGripperOpen: (open: boolean) => void;
  setRoboticArmGrabbing: (grabbing: boolean) => void;
  setRoboticArmGrabbedBlockId: (id: string | null) => void;
  resetRoboticArm: () => void;
  labObjects: Map<string, LabObjectData>;
  labConstraints: Map<string, LabConstraintData>;
  labTool: LabTool;
  selectedLabObjectId: string | null;
  selectedConstraintType: ConstraintType;
  selectedLabObjectType: LabObjectType;
  constraintStartObjectId: string | null;
  springStiffness: number;
  springDamping: number;
  ropeLength: number;
  addLabObject: (obj: LabObjectData) => void;
  removeLabObject: (id: string) => void;
  updateLabObjectPosition: (id: string, position: [number, number, number]) => void;
  addLabConstraint: (constraint: LabConstraintData) => void;
  removeLabConstraint: (id: string) => void;
  setLabTool: (tool: LabTool) => void;
  setSelectedLabObjectId: (id: string | null) => void;
  setSelectedConstraintType: (type: ConstraintType) => void;
  setSelectedLabObjectType: (type: LabObjectType) => void;
  setConstraintStartObjectId: (id: string | null) => void;
  setSpringStiffness: (value: number) => void;
  setSpringDamping: (value: number) => void;
  setRopeLength: (value: number) => void;
  resetPhysicsLab: () => void;
  blueprints: BlueprintData[];
  saveBlueprint: (name: string) => void;
  loadBlueprint: (id: string) => void;
  deleteBlueprint: (id: string) => void;
  refreshBlueprints: () => void;
}

const ecsWorld = new World();

const generateId = () => Math.random().toString(36).substr(2, 9);

export const WEAPON_DEFAULTS: WeaponCustomizations = {
  wreckingBall: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#444444', trailColor: '#ff6600', glowColor: '#ff3300', effectType: 'none' },
  },
  steelBall: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#888888', trailColor: '#00ffff', glowColor: '#00ccff', effectType: 'none' },
  },
  explosive: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#ff3300', trailColor: '#ff6600', glowColor: '#ff0000', effectType: 'none' },
  },
  sprayPaint: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#ff0066', trailColor: '#ff33cc', glowColor: '#ff0099', effectType: 'none' },
  },
};

export const UPGRADE_MAX_LEVEL = 5;

export const UPGRADE_LABELS: Record<WeaponUpgradeKey, string> = {
  damage: '威力',
  speed: '速度',
  radius: '范围',
};

export const UPGRADE_MULTIPLIERS: Record<WeaponUpgradeKey, (level: number) => number> = {
  damage: (level) => 1 + (level - 1) * 0.4,
  speed: (level) => 1 + (level - 1) * 0.25,
  radius: (level) => 1 + (level - 1) * 0.3,
};

export const EFFECT_TYPE_LABELS: Record<WeaponEffectType, string> = {
  none: '无',
  fire: '烈焰',
  electric: '雷电',
  rainbow: '彩虹',
  shadow: '暗影',
};

export const EFFECT_COLORS: Record<WeaponEffectType, { main: string; trail: string; glow: string }> = {
  none: { main: '', trail: '', glow: '' },
  fire: { main: '#ff4500', trail: '#ff8c00', glow: '#ff0000' },
  electric: { main: '#00bfff', trail: '#7df9ff', glow: '#0080ff' },
  rainbow: { main: '#ff00ff', trail: '#00ffff', glow: '#ffff00' },
  shadow: { main: '#2d1b69', trail: '#6b21a8', glow: '#4c1d95' },
};

export const materialProperties: Record<MaterialType, { color: string; health: number; density: number; emissive?: string }> = {
  wood: { color: '#8B4513', health: 50, density: 600, emissive: '#2a1505' },
  glass: { color: '#88ccff', health: 20, density: 2500, emissive: '#3366aa' },
  concrete: { color: '#808080', health: 150, density: 2400, emissive: '#333333' },
};

export const MAX_UNDO_STEPS = 50;

const EMPTY_SPECTRUM = new Float32Array(1024);

export const useGameStore = create<GameState>((set, get) => ({
  weapon: 'wreckingBall',
  setWeapon: (weapon) => set({ weapon }),
  weaponCustomizations: JSON.parse(JSON.stringify(WEAPON_DEFAULTS)),
  upgradeWeapon: (weapon, key) =>
    set((state) => ({
      weaponCustomizations: WeaponSystem.upgradeWeapon(state.weaponCustomizations, weapon, key),
    })),
  setWeaponAppearance: (weapon, key, value) =>
    set((state) => ({
      weaponCustomizations: WeaponSystem.setWeaponAppearance(state.weaponCustomizations, weapon, key, value),
    })),
  getWeaponUpgrade: (weapon, key) => get().weaponCustomizations[weapon].upgrades[key],
  getWeaponUpgradeMultiplier: (weapon, key) => {
    const level = get().weaponCustomizations[weapon].upgrades[key];
    return UPGRADE_MULTIPLIERS[key](level);
  },
  getWeaponAppearance: (weapon) => get().weaponCustomizations[weapon].appearance,
  resetWeaponCustomizations: () => set({ weaponCustomizations: WeaponSystem.resetWeaponCustomizations() }),
  blocks: new Map(),
  sprayColor: '#ff0066',
  setSprayColor: (color) => set({ sprayColor: color }),
  spraySize: 20,
  setSpraySize: (size) => set({ spraySize: clampSpraySize(size) }),
  addSprayPoint: (blockId: string, point: SprayPoint) => {
    BlockSystem.addSprayPoint(blockId, point, ecsWorld);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  getBlockSprayCanvas: (blockId: string) => {
    return BlockSystem.getBlockSprayCanvas(blockId);
  },
  getBlockSprayPoints: (blockId: string) => {
    return BlockSystem.getBlockSprayPoints(blockId);
  },
  audioAnalysis: {
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    spectrum: EMPTY_SPECTRUM,
    beatDetected: false,
  },
  setAudioAnalysis: (analysis) => set({ audioAnalysis: analysis }),
  audioEnabled: false,
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  audioEffectsConfig: {
    shakeIntensity: 0.6,
    glowIntensity: 0.8,
    collapseThreshold: 0.75,
    enableCollapse: true,
    colorMode: 'frequency',
  },
  updateAudioEffectsConfig: (config) =>
    set((state) => ({
      audioEffectsConfig: AudioSystem.updateAudioEffectsConfig(state.audioEffectsConfig, config),
    })),
  gravityDirection: 'down',
  setGravityDirection: (direction) => set({ gravityDirection: direction }),
  roboticArm: RoboticArmSystem.resetRoboticArm(),
  setRoboticArmBaseAngle: (angle) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'baseAngle', angle) })),
  setRoboticArmShoulderAngle: (angle) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'shoulderAngle', angle) })),
  setRoboticArmElbowAngle: (angle) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'elbowAngle', angle) })),
  setRoboticArmWristAngle: (angle) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'wristAngle', angle) })),
  setRoboticArmGripperOpen: (open) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'gripperOpen', open) })),
  setRoboticArmGrabbing: (grabbing) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'isGrabbing', grabbing) })),
  setRoboticArmGrabbedBlockId: (id) =>
    set((state) => ({ roboticArm: RoboticArmSystem.setRoboticArmField(state.roboticArm, 'grabbedBlockId', id) })),
  resetRoboticArm: () => set({ roboticArm: RoboticArmSystem.resetRoboticArm() }),
  addBlock: (block) => {
    BlockSystem.addBlock(ecsWorld, block);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  addBlocks: (newBlocks) => {
    newBlocks.forEach((block) => BlockSystem.addBlock(ecsWorld, block));
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  removeBlock: (id) => {
    BlockSystem.removeBlock(ecsWorld, id);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  damageBlock: (id, damage) => {
    const destroyed = BlockSystem.damageBlock(ecsWorld, id, damage);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
    return destroyed;
  },
  updateBlockPosition: (id, position) => {
    BlockSystem.updateBlockPosition(ecsWorld, id, position);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  updateBlockRotation: (id, rotation) => {
    BlockSystem.updateBlockRotation(ecsWorld, id, rotation);
    set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
  },
  particles: new Map(),
  addParticle: (particle) => {
    ParticleSystem.addParticle(ecsWorld, particle);
    set({ particles: ParticleSystem.collectParticlesFromWorld(ecsWorld) });
  },
  removeParticle: (id) => {
    ParticleSystem.removeParticle(ecsWorld, id);
    set({ particles: ParticleSystem.collectParticlesFromWorld(ecsWorld) });
  },
  updateParticle: (id, data) => {
    ParticleSystem.updateParticle(ecsWorld, id, data);
    set({ particles: ParticleSystem.collectParticlesFromWorld(ecsWorld) });
  },
  explosions: new Map(),
  addExplosion: (explosion) => {
    ExplosionSystem.addExplosion(ecsWorld, explosion);
    set({ explosions: ExplosionSystem.collectExplosionsFromWorld(ecsWorld) });
  },
  removeExplosion: (id) => {
    ExplosionSystem.removeExplosion(ecsWorld, id);
    set({ explosions: ExplosionSystem.collectExplosionsFromWorld(ecsWorld) });
  },
  updateExplosion: (id, data) => {
    ExplosionSystem.updateExplosion(ecsWorld, id, data);
    set({ explosions: ExplosionSystem.collectExplosionsFromWorld(ecsWorld) });
  },
  wreckingBallActive: false,
  setWreckingBallActive: (active) => set({ wreckingBallActive: active }),
  resetGame: () => {
    BlockSystem.clearBlockSprayData();
    const blockIds = ecsWorld.query(ComponentType.BlockTag);
    blockIds.forEach((id) => ecsWorld.destroyEntity(id));
    const particleIds = ecsWorld.query(ComponentType.ParticleTag);
    particleIds.forEach((id) => ecsWorld.destroyEntity(id));
    const explosionIds = ecsWorld.query(ComponentType.ExplosionTag);
    explosionIds.forEach((id) => ecsWorld.destroyEntity(id));
    set({
      blocks: new Map(),
      particles: new Map(),
      explosions: new Map(),
      wreckingBallActive: false,
      gravityDirection: 'down',
    });
  },
  world: null,
  setWorld: (world) => set({ world }),
  shootCooldown: false,
  setShootCooldown: (cooldown) => set({ shootCooldown: cooldown }),
  gameMode: 'destroy',
  setGameMode: (mode) => set({ gameMode: mode, selectedBlockId: null, undoStack: [], redoStack: [] }),
  buildMaterial: 'wood',
  setBuildMaterial: (material) => set({ buildMaterial: material }),
  buildTool: 'place',
  setBuildTool: (tool) => set({ buildTool: tool, selectedBlockId: tool !== 'move' && tool !== 'rotate' ? null : get().selectedBlockId }),
  selectedBlockId: null,
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  undoStack: [],
  redoStack: [],
  pushUndoAction: (action) => {
    const result = BuildSystem.pushUndoAction(get().undoStack, action);
    set({ undoStack: result.undoStack, redoStack: result.redoStack });
  },
  undo: () => {
    const { undoStack, redoStack } = get();
    const result = BuildSystem.applyUndo(ecsWorld, undoStack, redoStack);
    if (result) {
      set({
        blocks: BlockSystem.collectBlocksFromWorld(ecsWorld),
        undoStack: result.undoStack,
        redoStack: result.redoStack,
        selectedBlockId: null,
      });
    }
  },
  redo: () => {
    const { undoStack, redoStack } = get();
    const result = BuildSystem.applyRedo(ecsWorld, undoStack, redoStack);
    if (result) {
      set({
        blocks: BlockSystem.collectBlocksFromWorld(ecsWorld),
        undoStack: result.undoStack,
        redoStack: result.redoStack,
        selectedBlockId: null,
      });
    }
  },
  clearBuildState: () => {
    BuildSystem.clearBuildState(ecsWorld);
    set({
      blocks: BlockSystem.collectBlocksFromWorld(ecsWorld),
      undoStack: [],
      redoStack: [],
      selectedBlockId: null,
    });
  },
  labObjects: new Map(),
  labConstraints: new Map(),
  labTool: 'placeObject',
  selectedLabObjectId: null,
  selectedConstraintType: 'spring',
  selectedLabObjectType: 'box',
  constraintStartObjectId: null,
  springStiffness: 100,
  springDamping: 10,
  ropeLength: 5,
  addLabObject: (obj) => {
    PhysicsLabSystem.addLabObject(ecsWorld, obj);
    set({
      labObjects: PhysicsLabSystem.collectLabObjectsFromWorld(ecsWorld),
      labConstraints: PhysicsLabSystem.collectLabConstraintsFromWorld(ecsWorld),
    });
  },
  removeLabObject: (id) => {
    PhysicsLabSystem.removeLabObject(ecsWorld, id);
    set({
      labObjects: PhysicsLabSystem.collectLabObjectsFromWorld(ecsWorld),
      labConstraints: PhysicsLabSystem.collectLabConstraintsFromWorld(ecsWorld),
    });
  },
  updateLabObjectPosition: (id, position) => {
    PhysicsLabSystem.updateLabObjectPosition(ecsWorld, id, position);
    set({ labObjects: PhysicsLabSystem.collectLabObjectsFromWorld(ecsWorld) });
  },
  addLabConstraint: (constraint) => {
    PhysicsLabSystem.addLabConstraint(ecsWorld, constraint);
    set({ labConstraints: PhysicsLabSystem.collectLabConstraintsFromWorld(ecsWorld) });
  },
  removeLabConstraint: (id) => {
    PhysicsLabSystem.removeLabConstraint(ecsWorld, id);
    set({ labConstraints: PhysicsLabSystem.collectLabConstraintsFromWorld(ecsWorld) });
  },
  setLabTool: (tool) => set({ labTool: tool, constraintStartObjectId: null, selectedLabObjectId: null }),
  setSelectedLabObjectId: (id) => set({ selectedLabObjectId: id }),
  setSelectedConstraintType: (type) => set({ selectedConstraintType: type }),
  setSelectedLabObjectType: (type) => set({ selectedLabObjectType: type }),
  setConstraintStartObjectId: (id) => set({ constraintStartObjectId: id }),
  setSpringStiffness: (value) => set({ springStiffness: value }),
  setSpringDamping: (value) => set({ springDamping: value }),
  setRopeLength: (value) => set({ ropeLength: value }),
  resetPhysicsLab: () => {
    PhysicsLabSystem.resetPhysicsLab(ecsWorld);
    set({
      labObjects: new Map(),
      labConstraints: new Map(),
      selectedLabObjectId: null,
      constraintStartObjectId: null,
    });
  },
  blueprints: BlueprintSystem.loadBlueprintsFromStorage(),
  saveBlueprint: (name: string) => {
    const state = get();
    const result = BlueprintSystem.saveBlueprint(ecsWorld, name, state.blueprints, state.gravityDirection);
    if (result) {
      set({ blueprints: result });
    }
  },
  loadBlueprint: (id: string) => {
    const blueprint = get().blueprints.find((b) => b.id === id);
    if (!blueprint) return;
    BlueprintSystem.loadBlueprint(ecsWorld, blueprint);
    set({
      blocks: BlockSystem.collectBlocksFromWorld(ecsWorld),
      gravityDirection: blueprint.gravityDirection,
      undoStack: [],
      redoStack: [],
      selectedBlockId: null,
    });
  },
  deleteBlueprint: (id: string) => {
    const blueprints = BlueprintSystem.deleteBlueprint(id, get().blueprints);
    set({ blueprints });
  },
  refreshBlueprints: () => {
    set({ blueprints: BlueprintSystem.loadBlueprintsFromStorage() });
  },
}));

export { generateId, ecsWorld };
