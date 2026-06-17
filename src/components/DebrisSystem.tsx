import { useRef, useEffect, useRef as useReactRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MaterialType, materialProperties, GRAVITY_VECTORS } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';

interface DebrisData {
  id: string;
  mesh: THREE.Mesh;
  body: CANNON.Body;
  life: number;
  maxLife: number;
}

interface DebrisSystemProps {
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
  registerSpawner: (spawner: (position: [number, number, number], size: [number, number, number], material: MaterialType, sprayColors?: string[]) => void) => void;
}

export function DebrisSystem({
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
  registerSpawner,
}: DebrisSystemProps) {
  const debrisMap = useReactRef<Map<string, DebrisData>>(new Map());
  const nextId = useReactRef(0);
  const sceneRef = useRef<THREE.Group | null>(null);
  const gravityDirection = useGameStore((s) => s.gravityDirection);

  const spawnDebris = (
    position: [number, number, number],
    size: [number, number, number],
    material: MaterialType,
    sprayColors?: string[]
  ) => {
    const properties = materialProperties[material];
    const debrisCount = material === 'glass' ? 12 : 8;
    const baseColors: Record<MaterialType, string[]> = {
      wood: ['#5D3A1A', '#8B4513', '#A0522D', '#6B4423'],
      glass: ['#88ccff', '#aaddff', '#66bbff', '#cceeff'],
      concrete: ['#666666', '#808080', '#999999', '#555555'],
    };
    let colorPalette = [...baseColors[material]];
    if (sprayColors && sprayColors.length > 0) {
      colorPalette = [...colorPalette, ...sprayColors];
    }

    const gravVec = GRAVITY_VECTORS[useGameStore.getState().gravityDirection];
    const gravNorm = new THREE.Vector3(gravVec[0], gravVec[1], gravVec[2]).normalize();

    for (let i = 0; i < debrisCount; i++) {
      const id = `debris_${nextId.current++}`;
      const debrisSize: [number, number, number] = [
        size[0] * (0.15 + Math.random() * 0.25),
        size[1] * (0.15 + Math.random() * 0.25),
        size[2] * (0.15 + Math.random() * 0.25),
      ];

      const geometry = new THREE.BoxGeometry(debrisSize[0], debrisSize[1], debrisSize[2]);
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const meshMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: material === 'glass' ? 0.15 : 0.85,
        metalness: material === 'glass' ? 0.5 : 0.1,
        transparent: material === 'glass',
        opacity: material === 'glass' ? 0.7 : 1,
      });
      const mesh = new THREE.Mesh(geometry, meshMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const offset: [number, number, number] = [
        (Math.random() - 0.5) * size[0] * 0.8,
        (Math.random() - 0.5) * size[1] * 0.8,
        (Math.random() - 0.5) * size[2] * 0.8,
      ];
      mesh.position.set(
        position[0] + offset[0],
        position[1] + offset[1],
        position[2] + offset[2]
      );

      const volume = debrisSize[0] * debrisSize[1] * debrisSize[2];
      const mass = properties.density * volume * 0.000001 * 0.5;

      const halfSize = [debrisSize[0] / 2, debrisSize[1] / 2, debrisSize[2] / 2];
      const shape = new CANNON.Box(new CANNON.Vec3(halfSize[0], halfSize[1], halfSize[2]));
      const body = new CANNON.Body({
        mass: mass > 0.01 ? mass : 0.01,
        shape,
        position: new CANNON.Vec3(
          position[0] + offset[0],
          position[1] + offset[1],
          position[2] + offset[2]
        ),
        material: new CANNON.Material({ friction: 0.5, restitution: material === 'glass' ? 0.4 : 0.25 }),
        linearDamping: 0.05,
        angularDamping: 0.1,
        allowSleep: true,
      });
      (body as any).userData = { isDebris: true };

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
      velocity.add(gravNorm.clone().multiplyScalar(-(Math.random() * 8 + 4)));

      body.velocity.set(velocity.x, velocity.y, velocity.z);
      body.angularVelocity.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );

      addPhysicsBody(id, body);

      if (sceneRef.current) {
        sceneRef.current.add(mesh);
      }

      debrisMap.current.set(id, {
        id,
        mesh,
        body,
        life: 4 + Math.random() * 4,
        maxLife: 8,
      });
    }
  };

  useEffect(() => {
    registerSpawner(spawnDebris);
    return () => {
      debrisMap.current.forEach((debris, id) => {
        removePhysicsBody(id);
        if (debris.mesh.parent) {
          debris.mesh.parent.remove(debris.mesh);
        }
        debris.mesh.geometry.dispose();
        if (Array.isArray(debris.mesh.material)) {
          debris.mesh.material.forEach((m) => m.dispose());
        } else {
          debris.mesh.material.dispose();
        }
      });
      debrisMap.current.clear();
    };
  }, [registerSpawner, removePhysicsBody]);

  useFrame((_, delta) => {
    const toRemove: string[] = [];

    debrisMap.current.forEach((debris, id) => {
      const body = getPhysicsBody(id);
      if (!body) {
        toRemove.push(id);
        return;
      }

      debris.life -= delta;

      debris.mesh.position.set(
        body.position.x,
        body.position.y,
        body.position.z
      );
      debris.mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );

      const fadeStart = debris.maxLife * 0.6;
      if (debris.life < fadeStart) {
        const opacity = Math.max(0, debris.life / fadeStart);
        if (Array.isArray(debris.mesh.material)) {
          debris.mesh.material.forEach((m) => {
            m.transparent = true;
            m.opacity = opacity;
          });
        } else {
          debris.mesh.material.transparent = true;
          debris.mesh.material.opacity = opacity;
        }
      }

      if (debris.life <= 0) {
        toRemove.push(id);
      } else {
        const boundary = 80;
        switch (gravityDirection) {
          case 'down':
            if (body.position.y < -10) toRemove.push(id);
            break;
          case 'up':
            if (body.position.y > boundary) toRemove.push(id);
            break;
          case 'left':
            if (body.position.x < -boundary) toRemove.push(id);
            break;
          case 'right':
            if (body.position.x > boundary) toRemove.push(id);
            break;
          case 'forward':
            if (body.position.z > boundary) toRemove.push(id);
            break;
          case 'backward':
            if (body.position.z < -boundary) toRemove.push(id);
            break;
        }
        if (Math.abs(body.position.x) > boundary + 20 || Math.abs(body.position.z) > boundary + 20 || Math.abs(body.position.y) > boundary + 20) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach((id) => {
      const debris = debrisMap.current.get(id);
      if (debris) {
        removePhysicsBody(id);
        if (debris.mesh.parent) {
          debris.mesh.parent.remove(debris.mesh);
        }
        debris.mesh.geometry.dispose();
        if (Array.isArray(debris.mesh.material)) {
          debris.mesh.material.forEach((m) => m.dispose());
        } else {
          debris.mesh.material.dispose();
        }
        debrisMap.current.delete(id);
      }
    });
  });

  return <group ref={sceneRef} />;
}

export default DebrisSystem;
