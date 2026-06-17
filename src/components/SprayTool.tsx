import { useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, SprayPoint } from '@/store/gameStore';

export function SprayTool() {
  const { camera, scene, raycaster, pointer } = useThree();
  const weapon = useGameStore((s) => s.weapon);
  const sprayColor = useGameStore((s) => s.sprayColor);
  const spraySize = useGameStore((s) => s.spraySize);
  const addSprayPoint = useGameStore((s) => s.addSprayPoint);
  const gameMode = useGameStore((s) => s.gameMode);
  const buildTool = useGameStore((s) => s.buildTool);

  const isSprayActive = (gameMode === 'destroy' && weapon === 'sprayPaint') ||
    (gameMode === 'build' && buildTool === 'sprayPaint');

  const [isPainting, setIsPainting] = useState(false);
  const lastSprayPos = useRef({ x: -1, y: -1 });
  const sprayParticlesRef = useRef<Map<string, { mesh: THREE.Mesh; life: number; maxLife: number }>>(new Map());
  const particleIdRef = useRef(0);
  const sprayIndicatorRef = useRef<THREE.Group | null>(null);
  const hitPointRef = useRef(new THREE.Vector3());
  const hasValidTarget = useRef(false);

  const spawnSprayParticles = useCallback((position: THREE.Vector3, normal: THREE.Vector3, color: string) => {
    const count = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const id = `spray_particle_${particleIdRef.current++}`;
      const size = 0.02 + Math.random() * 0.04;
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spraySize * 0.015;
      mesh.position.copy(position);
      mesh.position.x += Math.cos(angle) * dist;
      mesh.position.y += Math.sin(angle) * dist;
      mesh.position.add(normal.clone().multiplyScalar(0.01 + Math.random() * 0.05));

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        0.02 + Math.random() * 0.03,
        (Math.random() - 0.5) * 0.02
      );
      (mesh as any).userData.velocity = velocity;

      scene.add(mesh);
      sprayParticlesRef.current.set(id, {
        mesh,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
      });
    }
  }, [scene, spraySize]);

  const handleSpray = useCallback(() => {
    if (!isSprayActive) return;

    raycaster.setFromCamera(pointer, camera);
    const blockMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.BoxGeometry) {
        if (obj.userData?.blockId || obj.userData?.isBuildBlock) {
          blockMeshes.push(obj);
        }
      }
    });

    const hits = raycaster.intersectObjects(blockMeshes, false);
    if (hits.length === 0) {
      hasValidTarget.current = false;
      return;
    }

    const hit = hits[0];
    hasValidTarget.current = true;
    hitPointRef.current.copy(hit.point);

    let blockId: string | null = null;

    if (hit.object.userData?.blockId) {
      blockId = hit.object.userData.blockId;
    }

    if (!blockId) {
      let currentObj: THREE.Object3D | null = hit.object;
      while (currentObj) {
        if (currentObj.userData?.blockId) {
          blockId = currentObj.userData.blockId;
          break;
        }
        if (currentObj.userData?.isBuildBlock && currentObj.userData?.blockId) {
          blockId = currentObj.userData.blockId;
          break;
        }
        currentObj = currentObj.parent;
      }
    }

    if (!blockId) {
      const blocks = useGameStore.getState().blocks;
      for (const [bid, blockData] of blocks.entries()) {
        const [bx, by, bz] = blockData.position;
        const [sx, sy, sz] = blockData.size;
        const dx = Math.abs(hit.point.x - bx);
        const dy = Math.abs(hit.point.y - by);
        const dz = Math.abs(hit.point.z - bz);
        if (dx <= sx / 2 + 0.01 && dy <= sy / 2 + 0.01 && dz <= sz / 2 + 0.01) {
          blockId = bid;
          break;
        }
      }
    }

    if (!blockId || !hit.face) return;

    const localPoint = hit.point.clone();
    hit.object.worldToLocal(localPoint);

    const normal = hit.face.normal.clone();
    normal.transformDirection(hit.object.matrixWorld);

    let uvX = 0.5;
    let uvY = 0.5;
    let faceName = 'front';

    const block = useGameStore.getState().blocks.get(blockId);
    if (block) {
      const halfW = block.size[0] / 2;
      const halfH = block.size[1] / 2;
      const halfD = block.size[2] / 2;

      if (Math.abs(normal.x) > 0.5) {
        faceName = normal.x > 0 ? 'right' : 'left';
        uvX = (localPoint.z + halfD) / (halfD * 2);
        uvY = (localPoint.y + halfH) / (halfH * 2);
      } else if (Math.abs(normal.y) > 0.5) {
        faceName = normal.y > 0 ? 'top' : 'bottom';
        uvX = (localPoint.x + halfW) / (halfW * 2);
        uvY = (localPoint.z + halfD) / (halfD * 2);
      } else if (Math.abs(normal.z) > 0.5) {
        faceName = normal.z > 0 ? 'front' : 'back';
        uvX = (localPoint.x + halfW) / (halfW * 2);
        uvY = (localPoint.y + halfH) / (halfH * 2);
      }
    }

    uvX = Math.max(0, Math.min(1, uvX));
    uvY = Math.max(0, Math.min(1, 1 - uvY));

    const dx = pointer.x - lastSprayPos.current.x;
    const dy = pointer.y - lastSprayPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const shouldSpray = lastSprayPos.current.x === -1 || dist > 0.005;

    if (shouldSpray) {
      const point: SprayPoint = {
        x: uvX,
        y: uvY,
        face: faceName,
        color: sprayColor,
        size: spraySize,
      };
      addSprayPoint(blockId, point);
      spawnSprayParticles(hit.point, normal, sprayColor);
      lastSprayPos.current = { x: pointer.x, y: pointer.y };
    }
  }, [camera, pointer, raycaster, scene, isSprayActive, sprayColor, spraySize, addSprayPoint, spawnSprayParticles]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isSprayActive) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) return;
      setIsPainting(true);
      lastSprayPos.current = { x: -1, y: -1 };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setIsPainting(false);
      lastSprayPos.current = { x: -1, y: -1 };
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSprayActive]);

  useEffect(() => {
    if (!isSprayActive) {
      if (sprayIndicatorRef.current) {
        scene.remove(sprayIndicatorRef.current);
        sprayIndicatorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        sprayIndicatorRef.current = null;
      }
      return;
    }

    if (sprayIndicatorRef.current) return;

    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(spraySize * 0.008, spraySize * 0.01, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: sprayColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = 'indicatorRing';
    group.add(ring);

    const dotGeo = new THREE.SphereGeometry(0.015, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: sprayColor,
      transparent: true,
      opacity: 0.9,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.name = 'indicatorDot';
    group.add(dot);

    scene.add(group);
    sprayIndicatorRef.current = group;
  }, [isSprayActive, scene, sprayColor, spraySize]);

  useFrame((_, delta) => {
    if (!isSprayActive) return;

    if (isPainting) {
      handleSpray();
    }

    if (sprayIndicatorRef.current) {
      raycaster.setFromCamera(pointer, camera);
      const blockMeshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.BoxGeometry) {
          if (obj.userData?.blockId || obj.userData?.isBuildBlock) {
            blockMeshes.push(obj);
          }
        }
      });

      const hits = raycaster.intersectObjects(blockMeshes, false);
      if (hits.length > 0) {
        const hit = hits[0];
        sprayIndicatorRef.current.position.copy(hit.point);
        const normal = hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
        normal.transformDirection(hit.object.matrixWorld);
        sprayIndicatorRef.current.lookAt(
          hit.point.x + normal.x,
          hit.point.y + normal.y,
          hit.point.z + normal.z
        );
        sprayIndicatorRef.current.visible = true;
        sprayIndicatorRef.current.position.add(normal.clone().multiplyScalar(0.01));

        const ring = sprayIndicatorRef.current.getObjectByName('indicatorRing') as THREE.Mesh;
        if (ring && ring.material instanceof THREE.MeshBasicMaterial) {
          ring.material.color.set(sprayColor);
          const scale = spraySize / 20;
          ring.scale.set(scale, scale, 1);
        }
        const dot = sprayIndicatorRef.current.getObjectByName('indicatorDot') as THREE.Mesh;
        if (dot && dot.material instanceof THREE.MeshBasicMaterial) {
          dot.material.color.set(sprayColor);
        }
      } else {
        sprayIndicatorRef.current.visible = false;
      }
    }

    const toRemove: string[] = [];
    sprayParticlesRef.current.forEach((particle, id) => {
      particle.life -= delta;
      const mesh = particle.mesh;
      const velocity = (mesh as any).userData.velocity as THREE.Vector3;
      if (velocity) {
        mesh.position.add(velocity);
        velocity.y -= delta * 0.15;
      }
      const opacity = Math.max(0, particle.life / particle.maxLife);
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
      mesh.scale.setScalar(0.5 + opacity * 0.5);
      if (particle.life <= 0) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => {
      const particle = sprayParticlesRef.current.get(id);
      if (particle) {
        scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        if (particle.mesh.material instanceof THREE.MeshBasicMaterial) {
          particle.mesh.material.dispose();
        }
        sprayParticlesRef.current.delete(id);
      }
    });
  });

  return null;
}

export default SprayTool;
