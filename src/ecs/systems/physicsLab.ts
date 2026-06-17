import type { World, EntityId } from '../core';
import { ComponentType } from '../components';
import type {
  TransformComponent,
  PhysicsBodyComponent,
  VisualComponent,
  LabObjectTagComponent,
  LabConstraintComponent,
} from '../components';
import type { LabObjectData, LabConstraintData, ConstraintType } from '../../store/gameStore';

export function addLabObject(world: World, obj: LabObjectData): void {
  const id = obj.id;
  world.createEntity(id);
  world.addComponent(id, {
    _type: ComponentType.LabObjectTag,
  } as LabObjectTagComponent);
  world.addComponent(id, {
    _type: ComponentType.Transform,
    position: [...obj.position] as [number, number, number],
    rotation: obj.rotation ? [...obj.rotation] as [number, number, number] : [0, 0, 0],
    size: obj.size ? [...obj.size] as [number, number, number] : [0, 0, 0],
  } as TransformComponent);
  world.addComponent(id, {
    _type: ComponentType.PhysicsBody,
    mass: obj.mass,
    isStatic: obj.isStatic,
    radius: obj.radius,
    height: obj.height,
  } as PhysicsBodyComponent);
  world.addComponent(id, {
    _type: ComponentType.Visual,
    color: obj.color,
    size: 0,
    life: 0,
    maxLife: 0,
  } as VisualComponent);
}

export function removeLabObject(world: World, id: EntityId): void {
  const constraintIds = world.query(ComponentType.LabConstraint);
  constraintIds.forEach((cid) => {
    const constraint = world.getComponent<LabConstraintComponent>(cid, ComponentType.LabConstraint);
    if (constraint && (constraint.bodyAId === id || constraint.bodyBId === id)) {
      world.destroyEntity(cid);
    }
  });
  world.destroyEntity(id);
}

export function updateLabObjectPosition(world: World, id: EntityId, position: [number, number, number]): void {
  const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
  if (transform) {
    world.addComponent(id, { ...transform, position: [...position] as [number, number, number] });
  }
}

export function addLabConstraint(world: World, constraint: LabConstraintData): void {
  const id = constraint.id;
  world.createEntity(id);
  world.addComponent(id, {
    _type: ComponentType.LabConstraint,
    constraintType: constraint.type,
    bodyAId: constraint.bodyAId,
    bodyBId: constraint.bodyBId,
    pivotA: constraint.pivotA,
    pivotB: constraint.pivotB,
    axisA: constraint.axisA,
    axisB: constraint.axisB,
    restLength: constraint.restLength,
    stiffness: constraint.stiffness,
    damping: constraint.damping,
    maxForce: constraint.maxForce,
    angle: constraint.angle,
  } as LabConstraintComponent);
}

export function removeLabConstraint(world: World, id: EntityId): void {
  world.destroyEntity(id);
}

export function resetPhysicsLab(world: World): void {
  const labObjectIds = world.query(ComponentType.LabObjectTag);
  labObjectIds.forEach((id) => world.destroyEntity(id));
  const labConstraintIds = world.query(ComponentType.LabConstraint);
  labConstraintIds.forEach((id) => world.destroyEntity(id));
}

export function collectLabObjectsFromWorld(world: World): Map<string, LabObjectData> {
  const result = new Map<string, LabObjectData>();
  const ids = world.query(ComponentType.LabObjectTag);
  ids.forEach((id) => {
    const transform = world.getComponent<TransformComponent>(id, ComponentType.Transform);
    const physics = world.getComponent<PhysicsBodyComponent>(id, ComponentType.PhysicsBody);
    const visual = world.getComponent<VisualComponent>(id, ComponentType.Visual);
    if (transform && physics && visual) {
      result.set(id, {
        id,
        type: 'box',
        position: [...transform.position] as [number, number, number],
        size: transform.size[0] !== 0 ? [...transform.size] as [number, number, number] : undefined,
        radius: physics.radius,
        height: physics.height,
        mass: physics.mass,
        color: visual.color,
        isStatic: physics.isStatic,
        rotation: transform.rotation[0] !== 0 || transform.rotation[1] !== 0 || transform.rotation[2] !== 0
          ? [...transform.rotation] as [number, number, number]
          : undefined,
      });
    }
  });
  return result;
}

export function collectLabConstraintsFromWorld(world: World): Map<string, LabConstraintData> {
  const result = new Map<string, LabConstraintData>();
  const ids = world.query(ComponentType.LabConstraint);
  ids.forEach((id) => {
    const constraint = world.getComponent<LabConstraintComponent>(id, ComponentType.LabConstraint);
    if (constraint) {
      result.set(id, {
        id,
        type: constraint.constraintType as ConstraintType,
        bodyAId: constraint.bodyAId,
        bodyBId: constraint.bodyBId,
        pivotA: constraint.pivotA,
        pivotB: constraint.pivotB,
        axisA: constraint.axisA,
        axisB: constraint.axisB,
        restLength: constraint.restLength,
        stiffness: constraint.stiffness,
        damping: constraint.damping,
        maxForce: constraint.maxForce,
        angle: constraint.angle,
      });
    }
  });
  return result;
}
