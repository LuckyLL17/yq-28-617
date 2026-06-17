import type { World, EntityId } from '../core';
import { ComponentType } from '../components';
import type {
  TransformComponent,
  ExplosionComponent,
  VisualComponent,
  ExplosionTagComponent,
} from '../components';
import type { ExplosionData } from '../../store/gameStore';

export function addExplosion(world: World, explosion: ExplosionData): void {
  const id = explosion.id;
  world.createEntity(id);
  world.addComponent(id, {
    _type: ComponentType.ExplosionTag,
  } as ExplosionTagComponent);
  world.addComponent(id, {
    _type: ComponentType.Transform,
    position: [...explosion.position] as [number, number, number],
    rotation: [0, 0, 0],
    size: [0, 0, 0],
  } as TransformComponent);
  world.addComponent(id, {
    _type: ComponentType.Explosion,
    radius: explosion.radius,
  } as ExplosionComponent);
  world.addComponent(id, {
    _type: ComponentType.Visual,
    color: '',
    size: 0,
    life: explosion.life,
    maxLife: explosion.maxLife,
  } as VisualComponent);
}

export function removeExplosion(world: World, id: EntityId): void {
  world.destroyEntity(id);
}

export function updateExplosion(world: World, id: EntityId, data: Partial<ExplosionData>): void {
  if (data.position) {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    if (transform) {
      world.addComponent(id, { ...transform, position: [...data.position] as [number, number, number] });
    }
  }
  if (data.radius !== undefined) {
    const explosion = world.getComponent<ExplosionComponent>(id, ComponentType.Explosion);
    if (explosion) {
      world.addComponent(id, { ...explosion, radius: data.radius });
    }
  }
  if (data.life !== undefined || data.maxLife !== undefined) {
    const visual = world.getComponent<VisualComponent>(id, ComponentType.Visual);
    if (visual) {
      world.addComponent(id, {
        ...visual,
        ...(data.life !== undefined && { life: data.life }),
        ...(data.maxLife !== undefined && { maxLife: data.maxLife }),
      });
    }
  }
}

export function collectExplosionsFromWorld(world: World): Map<string, ExplosionData> {
  const result = new Map<string, ExplosionData>();
  const ids = world.query(ComponentType.ExplosionTag);
  ids.forEach((id) => {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    const explosion = world.getComponent<ExplosionComponent>(id, ComponentType.Explosion);
    const visual = world.getComponent<VisualComponent>(id, ComponentType.Visual);
    if (transform && explosion && visual) {
      result.set(id, {
        id,
        position: [...transform.position] as [number, number, number],
        radius: explosion.radius,
        life: visual.life,
        maxLife: visual.maxLife,
      });
    }
  });
  return result;
}
