import type { IComponent } from './core';

export const ComponentType = {
  Transform: 'transform',
  Health: 'health',
  Material: 'material',
  Spray: 'spray',
  Visual: 'visual',
  Velocity: 'velocity',
  Explosion: 'explosion',
  PhysicsBody: 'physicsBody',
  LabConstraint: 'labConstraint',
  BlockTag: 'blockTag',
  ParticleTag: 'particleTag',
  ExplosionTag: 'explosionTag',
  LabObjectTag: 'labObjectTag',
} as const;

export type ComponentTypeValue = (typeof ComponentType)[keyof typeof ComponentType];

export interface TransformComponent extends IComponent {
  _type: typeof ComponentType.Transform;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
}

export interface HealthComponent extends IComponent {
  _type: typeof ComponentType.Health;
  health: number;
  maxHealth: number;
}

export interface MaterialComponent extends IComponent {
  _type: typeof ComponentType.Material;
  material: string;
}

export interface SprayComponent extends IComponent {
  _type: typeof ComponentType.Spray;
  sprayTextureVersion: number;
}

export interface VisualComponent extends IComponent {
  _type: typeof ComponentType.Visual;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface VelocityComponent extends IComponent {
  _type: typeof ComponentType.Velocity;
  velocity: [number, number, number];
}

export interface ExplosionComponent extends IComponent {
  _type: typeof ComponentType.Explosion;
  radius: number;
}

export interface PhysicsBodyComponent extends IComponent {
  _type: typeof ComponentType.PhysicsBody;
  mass: number;
  isStatic: boolean;
  radius?: number;
  height?: number;
}

export interface LabConstraintComponent extends IComponent {
  _type: typeof ComponentType.LabConstraint;
  constraintType: string;
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

export interface BlockTagComponent extends IComponent {
  _type: typeof ComponentType.BlockTag;
}

export interface ParticleTagComponent extends IComponent {
  _type: typeof ComponentType.ParticleTag;
}

export interface ExplosionTagComponent extends IComponent {
  _type: typeof ComponentType.ExplosionTag;
}

export interface LabObjectTagComponent extends IComponent {
  _type: typeof ComponentType.LabObjectTag;
}

export const BLOCK_ARCHETYPE = [ComponentType.BlockTag, ComponentType.Transform, ComponentType.Health, ComponentType.Material, ComponentType.Spray] as const;
export const PARTICLE_ARCHETYPE = [ComponentType.ParticleTag, ComponentType.Transform, ComponentType.Velocity, ComponentType.Visual] as const;
export const EXPLOSION_ARCHETYPE = [ComponentType.ExplosionTag, ComponentType.Transform, ComponentType.Explosion, ComponentType.Visual] as const;
export const LAB_OBJECT_ARCHETYPE = [ComponentType.LabObjectTag, ComponentType.Transform, ComponentType.PhysicsBody, ComponentType.Visual] as const;
export const LAB_CONSTRAINT_TYPE = ComponentType.LabConstraint;
