import type { World, EntityId } from '../core';
import { ComponentType } from '../components';
import type {
  TransformComponent,
  VelocityComponent,
  VisualComponent,
  ParticleTagComponent,
} from '../components';
import type { ParticleData } from '../../store/gameStore';

export function addParticle(world: World, particle: ParticleData): void {
  const id = particle.id;
  world.createEntity(id);
  world.addComponent(id, {
    _type: ComponentType.ParticleTag,
  } as ParticleTagComponent);
  world.addComponent(id, {
    _type: ComponentType.Transform,
    position: [...particle.position] as [number, number, number],
    rotation: [0, 0, 0],
    size: [0, 0, 0],
  } as TransformComponent);
  world.addComponent(id, {
    _type: ComponentType.Velocity,
    velocity: [...particle.velocity] as [number, number, number],
  } as VelocityComponent);
  world.addComponent(id, {
    _type: ComponentType.Visual,
    color: particle.color,
    size: particle.size,
    life: particle.life,
    maxLife: particle.maxLife,
  } as VisualComponent);
}

export function removeParticle(world: World, id: EntityId): void {
  world.destroyEntity(id);
}

export function updateParticle(world: World, id: EntityId, data: Partial<ParticleData>): void {
  if (data.position) {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    if (transform) {
      world.addComponent(id, { ...transform, position: [...data.position] as [number, number, number] });
    }
  }
  if (data.velocity) {
    const velocity = world.getComponent<VelocityComponent>(id, ComponentType.Velocity);
    if (velocity) {
      world.addComponent(id, { ...velocity, velocity: [...data.velocity] as [number, number, number] });
    }
  }
  if (data.color !== undefined || data.size !== undefined || data.life !== undefined || data.maxLife !== undefined) {
    const visual = world.getComponent<VisualComponent>(id, ComponentType.Visual);
    if (visual) {
      world.addComponent(id, {
        ...visual,
        ...(data.color !== undefined && { color: data.color }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.life !== undefined && { life: data.life }),
        ...(data.maxLife !== undefined && { maxLife: data.maxLife }),
      });
    }
  }
}

export function collectParticlesFromWorld(world: World): Map<string, ParticleData> {
  const result = new Map<string, ParticleData>();
  const ids = world.query(ComponentType.ParticleTag);
  ids.forEach((id) => {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    const velocity = world.getComponent<VelocityComponent>(id, ComponentType.Velocity);
    const visual = world.getComponent<VisualComponent>(id, ComponentType.Visual);
    if (transform && velocity && visual) {
      result.set(id, {
        id,
        position: [...transform.position] as [number, number, number],
        velocity: [...velocity.velocity] as [number, number, number],
        color: visual.color,
        size: visual.size,
        life: visual.life,
        maxLife: visual.maxLife,
      });
    }
  });
  return result;
}
