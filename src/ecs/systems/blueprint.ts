import type { World } from '../core';
import type {
  BlueprintData,
  BlockData,
  MaterialType,
  GravityDirection,
} from '../../store/gameStore';
import { materialProperties } from '../../store/gameStore';
import { addBlock, clearBlockSprayData, collectBlocksFromWorld } from './block';
import { ComponentType } from '../components';

const BLUEPRINTS_KEY = 'destruction-blueprints';

export function loadBlueprintsFromStorage(): BlueprintData[] {
  try {
    const raw = localStorage.getItem(BLUEPRINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBlueprintsToStorage(blueprints: BlueprintData[]): void {
  try {
    localStorage.setItem(BLUEPRINTS_KEY, JSON.stringify(blueprints));
  } catch {}
}

export function saveBlueprint(
  world: World,
  name: string,
  existingBlueprints: BlueprintData[],
  gravityDirection: GravityDirection
): BlueprintData[] | null {
  const blocks = collectBlocksFromWorld(world);
  const blockEntries: BlueprintData['blocks'] = [];
  blocks.forEach((block) => {
    blockEntries.push({
      position: [...block.position] as [number, number, number],
      size: [...block.size] as [number, number, number],
      material: block.material,
      rotation: block.rotation ? [...block.rotation] as [number, number, number] : undefined,
    });
  });

  if (blockEntries.length === 0) return null;

  const generateId = () => Math.random().toString(36).substr(2, 9);
  const blueprint: BlueprintData = {
    id: generateId(),
    name,
    blocks: blockEntries,
    gravityDirection,
    createdAt: Date.now(),
  };

  const blueprints = [...existingBlueprints, blueprint];
  saveBlueprintsToStorage(blueprints);
  return blueprints;
}

export function loadBlueprint(
  world: World,
  blueprint: BlueprintData
): void {
  clearBlockSprayData();

  const blockIds = world.query(ComponentType.BlockTag);
  blockIds.forEach((id) => world.destroyEntity(id));

  blueprint.blocks.forEach((entry) => {
    const generateId = () => Math.random().toString(36).substr(2, 9);
    const blockId = generateId();
    const props = materialProperties[entry.material];
    addBlock(world, {
      id: blockId,
      position: [...entry.position] as [number, number, number],
      size: [...entry.size] as [number, number, number],
      material: entry.material,
      health: props.health,
      maxHealth: props.health,
      rotation: entry.rotation ? [...entry.rotation] as [number, number, number] : [0, 0, 0],
    });
  });
}

export function deleteBlueprint(
  id: string,
  existingBlueprints: BlueprintData[]
): BlueprintData[] {
  const blueprints = existingBlueprints.filter((b) => b.id !== id);
  saveBlueprintsToStorage(blueprints);
  return blueprints;
}
