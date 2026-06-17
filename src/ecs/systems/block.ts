import type { World, EntityId } from '../core';
import { ComponentType } from '../components';
import type {
  TransformComponent,
  HealthComponent,
  MaterialComponent,
  SprayComponent,
  BlockTagComponent,
} from '../components';
import type { BlockData, SprayPoint, MaterialType } from '../../store/gameStore';
import { materialProperties } from '../../store/gameStore';

const blockSprayCanvases = new Map<string, HTMLCanvasElement>();
const blockSprayPoints = new Map<string, SprayPoint[]>();
const SPRAY_CANVAS_SIZE = 256;

function createSprayCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRAY_CANVAS_SIZE;
  canvas.height = SPRAY_CANVAS_SIZE;
  return canvas;
}

function getOrCreateSprayCanvas(blockId: string): HTMLCanvasElement {
  let canvas = blockSprayCanvases.get(blockId);
  if (!canvas) {
    canvas = createSprayCanvas();
    blockSprayCanvases.set(blockId, canvas);
    blockSprayPoints.set(blockId, []);
  }
  return canvas;
}

export function addBlock(world: World, block: BlockData): void {
  const id = block.id;
  world.createEntity(id);
  world.addComponent(id, {
    _type: ComponentType.BlockTag,
  } as BlockTagComponent);
  world.addComponent(id, {
    _type: ComponentType.Transform,
    position: [...block.position] as [number, number, number],
    rotation: block.rotation ? [...block.rotation] as [number, number, number] : [0, 0, 0],
    size: [...block.size] as [number, number, number],
  } as TransformComponent);
  world.addComponent(id, {
    _type: ComponentType.Health,
    health: block.health,
    maxHealth: block.maxHealth,
  } as HealthComponent);
  world.addComponent(id, {
    _type: ComponentType.Material,
    material: block.material,
  } as MaterialComponent);
  world.addComponent(id, {
    _type: ComponentType.Spray,
    sprayTextureVersion: block.sprayTextureVersion ?? 0,
  } as SprayComponent);
}

export function removeBlock(world: World, id: EntityId): void {
  blockSprayCanvases.delete(id);
  blockSprayPoints.delete(id);
  world.destroyEntity(id);
}

export function damageBlock(world: World, id: EntityId, damage: number): boolean {
  const health = world.getComponent<HealthComponent>(id, ComponentType.Health);
  if (!health) return false;
  const newHealth = health.health - damage;
  if (newHealth <= 0) {
    removeBlock(world, id);
    return true;
  }
  world.addComponent(id, { ...health, health: newHealth });
  return false;
}

export function updateBlockPosition(world: World, id: EntityId, position: [number, number, number]): void {
  const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
  if (transform) {
    world.addComponent(id, { ...transform, position: [...position] as [number, number, number] });
  }
}

export function updateBlockRotation(world: World, id: EntityId, rotation: [number, number, number]): void {
  const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
  if (transform) {
    world.addComponent(id, { ...transform, rotation: [...rotation] as [number, number, number] });
  }
}

export function addSprayPoint(blockId: string, point: SprayPoint, world: World): void {
  const canvas = getOrCreateSprayCanvas(blockId);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      point.x * SPRAY_CANVAS_SIZE,
      point.y * SPRAY_CANVAS_SIZE,
      0,
      point.x * SPRAY_CANVAS_SIZE,
      point.y * SPRAY_CANVAS_SIZE,
      point.size
    );
    gradient.addColorStop(0, point.color);
    gradient.addColorStop(0.4, point.color + 'cc');
    gradient.addColorStop(0.7, point.color + '66');
    gradient.addColorStop(1, point.color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
      point.x * SPRAY_CANVAS_SIZE,
      point.y * SPRAY_CANVAS_SIZE,
      point.size,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    const particles = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < particles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * point.size * 0.8;
      const px = point.x * SPRAY_CANVAS_SIZE + Math.cos(angle) * dist;
      const py = point.y * SPRAY_CANVAS_SIZE + Math.sin(angle) * dist;
      const psize = point.size * (0.1 + Math.random() * 0.3);
      ctx.fillStyle = point.color + Math.floor(80 + Math.random() * 120).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(px, py, psize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const points = blockSprayPoints.get(blockId) || [];
  points.push(point);
  blockSprayPoints.set(blockId, points);

  const spray = world.getComponent<SprayComponent>(blockId, ComponentType.Spray);
  if (spray) {
    world.addComponent(blockId, {
      ...spray,
      sprayTextureVersion: (spray.sprayTextureVersion || 0) + 1,
    });
  }
}

export function getBlockSprayCanvas(blockId: string): HTMLCanvasElement | null {
  return blockSprayCanvases.get(blockId) || null;
}

export function getBlockSprayPoints(blockId: string): SprayPoint[] {
  return blockSprayPoints.get(blockId) || [];
}

export function collectBlocksFromWorld(world: World): Map<string, BlockData> {
  const result = new Map<string, BlockData>();
  const ids = world.query(ComponentType.BlockTag);
  ids.forEach((id) => {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    const health = world.getComponent<HealthComponent>(id, ComponentType.Health);
    const material = world.getComponent<MaterialComponent>(id, ComponentType.Material);
    const spray = world.getComponent<SprayComponent>(id, ComponentType.Spray);
    if (transform && health && material) {
      result.set(id, {
        id,
        position: [...transform.position] as [number, number, number],
        size: [...transform.size] as [number, number, number],
        material: material.material as MaterialType,
        health: health.health,
        maxHealth: health.maxHealth,
        rotation: [...transform.rotation] as [number, number, number],
        sprayCanvas: null,
        sprayTextureVersion: spray?.sprayTextureVersion ?? 0,
      });
    }
  });
  return result;
}

export function clearBlockSprayData(): void {
  blockSprayCanvases.clear();
  blockSprayPoints.clear();
}
