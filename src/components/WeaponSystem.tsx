import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, WeaponType, GRAVITY_VECTORS, UPGRADE_MULTIPLIERS } from '@/store/gameStore';

interface WeaponSystemProps {
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
  addConstraint: (constraint: CANNON.Constraint) => boolean;
  removeConstraint: (constraint: CANNON.Constraint) => void;
  applyExplosion: (position: [number, number, number], radius: number, force: number) => void;
  onExplosion: (position: [number, number, number], radius: number) => void;
  rebuildCounter: number;
}

interface Projectile {
  id: string;
  type: 'steelBall' | 'explosive';
  mesh: THREE.Mesh;
  body: CANNON.Body;
  life: number;
  exploded?: boolean;
}

interface WreckingBallState {
  ballMesh: THREE.Mesh;
  ballBody: CANNON.Body;
  chainPoints: THREE.Vector3[];
  anchorBody: CANNON.Body;
  constraint: CANNON.Constraint;
  constraintAdded: boolean;
  isDragging: boolean;
  dragStartPos: THREE.Vector3;
  aimLine: THREE.Line;
}

export function WeaponSystem({
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
  addConstraint,
  removeConstraint,
  applyExplosion,
  onExplosion,
  rebuildCounter,
}: WeaponSystemProps) {
  const { camera, scene } = useThree();
  const weapon = useGameStore((s) => s.weapon);
  const shootCooldown = useGameStore((s) => s.shootCooldown);
  const setShootCooldown = useGameStore((s) => s.setShootCooldown);
  const wreckingBallActive = useGameStore((s) => s.wreckingBallActive);
  const setWreckingBallActive = useGameStore((s) => s.setWreckingBallActive);
  const weaponCustomizationsRef = useRef(useGameStore.getState().weaponCustomizations);
  const lastAppearanceHashRef = useRef<string>('');

  const projectilesRef = useRef<Map<string, Projectile>>(new Map());
  const wreckingBallRef = useRef<WreckingBallState | null>(null);
  const wreckingBallGroupRef = useRef<THREE.Group | null>(null);
  const cooldownTimerRef = useRef(0);
  const launcherRef = useRef<THREE.Group | null>(null);
  const launcherRecoilRef = useRef(0);
  const recoilTargetRef = useRef(0);
  const muzzleFlashRef = useRef(0);
  const lastWeaponRef = useRef<WeaponType | null>(null);
  const wreckingBallId = 'wreckingBall';

  const launcherMatsRef = useRef<{
    mainBodyMat?: THREE.MeshStandardMaterial;
    barrelMat?: THREE.MeshStandardMaterial;
    muzzleMat?: THREE.MeshStandardMaterial;
    indicatorMat?: THREE.MeshStandardMaterial;
    muzzleFlashMat?: THREE.MeshBasicMaterial;
  }>({});

  const updateLauncherAppearance = useCallback(() => {
    if (!launcherRef.current) return;
    const state = useGameStore.getState();
    const currentWeapon = state.weapon;
    if (currentWeapon === 'wreckingBall' || currentWeapon === 'sprayPaint') return;
    const custom = state.weaponCustomizations[currentWeapon];
    const appearance = custom.appearance;
    const mats = launcherMatsRef.current;
    const glowIntensity = appearance.effectType !== 'none' ? 0.15 : 0;

    if (mats.mainBodyMat) {
      mats.mainBodyMat.color.set(appearance.mainColor);
      mats.mainBodyMat.emissive.set(appearance.glowColor);
      mats.mainBodyMat.emissiveIntensity = glowIntensity;
    }
    if (mats.barrelMat) {
      mats.barrelMat.color.set(appearance.mainColor);
    }
    if (mats.muzzleMat) {
      mats.muzzleMat.color.set(appearance.mainColor);
    }
    if (mats.indicatorMat) {
      mats.indicatorMat.color.set(appearance.glowColor);
      mats.indicatorMat.emissive.set(appearance.glowColor);
    }
    if (mats.muzzleFlashMat) {
      mats.muzzleFlashMat.color.set(appearance.trailColor);
    }
  }, []);

  const createLauncher = useCallback((currentWeapon: WeaponType) => {
    if (launcherRef.current) {
      if (launcherRef.current.parent) {
        launcherRef.current.parent.remove(launcherRef.current);
      }
      launcherRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      launcherRef.current = null;
      launcherMatsRef.current = {};
    }

    if (currentWeapon === 'wreckingBall') return;

    const custom = useGameStore.getState().weaponCustomizations[currentWeapon];
    const appearance = custom.appearance;
    const glowIntensity = appearance.effectType !== 'none' ? 0.15 : 0;

    const group = new THREE.Group();

    const mainBodyGeo = new THREE.BoxGeometry(0.15, 0.15, 0.4);
    const mainBodyMat = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.9,
      roughness: 0.2,
      emissive: appearance.glowColor,
      emissiveIntensity: glowIntensity,
    });
    const mainBody = new THREE.Mesh(mainBodyGeo, mainBodyMat);
    mainBody.position.z = -0.1;
    group.add(mainBody);
    launcherMatsRef.current.mainBodyMat = mainBodyMat;

    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.3, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.95,
      roughness: 0.1,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = -Math.PI / 2;
    barrel.position.z = -0.35;
    group.add(barrel);
    launcherMatsRef.current.barrelMat = barrelMat;

    const muzzleGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.05, 16);
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.9,
      roughness: 0.1,
    });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.rotation.x = -Math.PI / 2;
    muzzle.position.z = -0.55;
    group.add(muzzle);
    launcherMatsRef.current.muzzleMat = muzzleMat;

    const gripGeo = new THREE.BoxGeometry(0.12, 0.2, 0.15);
    const gripMat = new THREE.MeshStandardMaterial({
      color: currentWeapon === 'explosive' ? '#8B0000' : '#4a3728',
      metalness: 0.3,
      roughness: 0.7,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -0.15;
    grip.position.z = 0.05;
    group.add(grip);

    const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12);
    const scopeMat = new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      metalness: 0.9,
      roughness: 0.2,
    });
    const scope = new THREE.Mesh(scopeGeo, scopeMat);
    scope.rotation.x = -Math.PI / 2;
    scope.position.y = 0.1;
    scope.position.z = -0.15;
    group.add(scope);

    if (currentWeapon === 'explosive') {
      const indicatorGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: appearance.glowColor,
        emissive: appearance.glowColor,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.5,
      });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.y = 0.12;
      indicator.position.z = 0.1;
      group.add(indicator);
      launcherMatsRef.current.indicatorMat = indicatorMat;
    }

    const muzzleFlashGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({
      color: appearance.trailColor,
      transparent: true,
      opacity: 0,
    });
    const muzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlash.position.z = -0.65;
    muzzleFlash.name = 'muzzleFlash';
    group.add(muzzleFlash);
    launcherMatsRef.current.muzzleFlashMat = muzzleFlashMat;

    group.position.set(0.3, -0.2, -0.5);

    camera.add(group);

    launcherRef.current = group;
  }, [camera]);

  const createWreckingBall = useCallback(() => {
    if (wreckingBallRef.current) return;

    const gravityDir = useGameStore.getState().gravityDirection;
    const gravVec = GRAVITY_VECTORS[gravityDir];
    const antiGravRaw = new CANNON.Vec3(-gravVec[0], -gravVec[1], -gravVec[2]);
    const antiGravLen = Math.sqrt(antiGravRaw.x * antiGravRaw.x + antiGravRaw.y * antiGravRaw.y + antiGravRaw.z * antiGravRaw.z);
    const antiGrav = new CANNON.Vec3(
      antiGravRaw.x / antiGravLen,
      antiGravRaw.y / antiGravLen,
      antiGravRaw.z / antiGravLen
    );

    const anchorOffset = 30;
    const anchorPosition = new CANNON.Vec3(
      antiGrav.x * anchorOffset,
      antiGrav.y * anchorOffset - 5,
      antiGrav.z * anchorOffset - 5
    );
    const ballStartPosition = new CANNON.Vec3(
      antiGrav.x * (anchorOffset - 3),
      antiGrav.y * (anchorOffset - 3) - 5,
      antiGrav.z * (anchorOffset - 3) - 5
    );

    const anchorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(0.3),
      position: anchorPosition,
    });
    addPhysicsBody('wreckingAnchor', anchorBody);

    const custom = useGameStore.getState().weaponCustomizations.wreckingBall;
    const dmgMult = UPGRADE_MULTIPLIERS.damage(custom.upgrades.damage);
    const radMult = UPGRADE_MULTIPLIERS.radius(custom.upgrades.radius);
    const baseMass = 500;
    const ballMass = baseMass * dmgMult;
    const baseRadius = 1.2;
    const ballRadius = baseRadius * Math.pow(radMult, 0.4);
    const ballBody = new CANNON.Body({
      mass: ballMass,
      shape: new CANNON.Sphere(ballRadius),
      position: ballStartPosition,
      material: new CANNON.Material({ friction: 0.3, restitution: 0.4 }),
      linearDamping: 0.05,
      angularDamping: 0.05,
      allowSleep: true,
      sleepSpeedLimit: 0.01,
      sleepTimeLimit: 0.01,
    });
    (ballBody as any).userData = { isWreckingBall: true };
    ballBody.sleep();
    addPhysicsBody(wreckingBallId, ballBody);

    const chainLen = 3 * UPGRADE_MULTIPLIERS.speed(custom.upgrades.speed);
    const constraint = new CANNON.DistanceConstraint(anchorBody, ballBody, chainLen);
    const constraintAdded = addConstraint(constraint);

    const group = new THREE.Group();

    const appearance = custom.appearance;
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.9,
      roughness: 0.3,
      emissive: appearance.glowColor,
      emissiveIntensity: appearance.effectType !== 'none' ? 0.3 : 0,
    });
    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    group.add(ballMesh);

    const spikeGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.9,
      roughness: 0.2,
      emissive: appearance.glowColor,
      emissiveIntensity: appearance.effectType !== 'none' ? 0.2 : 0,
    });
    const spikeCount = 8 + Math.floor((custom.upgrades.damage - 1) * 2);
    for (let i = 0; i < spikeCount; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = (i / spikeCount) * Math.PI * 2;
      spike.position.set(
        Math.cos(angle) * ballRadius * 0.85,
        (Math.random() - 0.5) * ballRadius * 0.6,
        Math.sin(angle) * ballRadius * 0.85
      );
      spike.lookAt(spike.position.clone().multiplyScalar(2));
      spike.scale.set(1, 1.5, 1);
      group.add(spike);
    }

    const chainPoints: THREE.Vector3[] = [];
    const chainSegments = 15;
    const chainGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    const chainMaterial = new THREE.MeshStandardMaterial({
      color: appearance.trailColor,
      metalness: 0.8,
      roughness: 0.4,
    });

    for (let i = 0; i < chainSegments; i++) {
      const link = new THREE.Mesh(chainGeometry, chainMaterial);
      link.userData.chainIndex = i;
      group.add(link);
      chainPoints.push(new THREE.Vector3());
    }

    const aimLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const aimLineMat = new THREE.LineDashedMaterial({
      color: appearance.trailColor,
      linewidth: 3,
      dashSize: 0.3,
      gapSize: 0.15,
      transparent: true,
      opacity: 0,
    });
    const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
    group.add(aimLine);

    scene.add(group);
    wreckingBallGroupRef.current = group;

    wreckingBallRef.current = {
      ballMesh,
      ballBody,
      chainPoints,
      anchorBody,
      constraint,
      constraintAdded,
      isDragging: false,
      dragStartPos: new THREE.Vector3(),
      aimLine,
    };

    setWreckingBallActive(true);
  }, [addPhysicsBody, addConstraint, scene, setWreckingBallActive]);

  const removeWreckingBall = useCallback(() => {
    if (!wreckingBallRef.current) return;

    if (wreckingBallRef.current.constraintAdded) {
      removeConstraint(wreckingBallRef.current.constraint);
    }

    removePhysicsBody('wreckingAnchor');
    removePhysicsBody(wreckingBallId);

    if (wreckingBallGroupRef.current) {
      scene.remove(wreckingBallGroupRef.current);
      wreckingBallGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      wreckingBallGroupRef.current = null;
    }

    wreckingBallRef.current = null;
    setWreckingBallActive(false);
  }, [removePhysicsBody, removeConstraint, scene, setWreckingBallActive]);

  const fireSteelBall = useCallback(() => {
    const id = `steelBall_${Date.now()}_${Math.random()}`;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(2));

    const custom = useGameStore.getState().weaponCustomizations.steelBall;
    const dmgMult = UPGRADE_MULTIPLIERS.damage(custom.upgrades.damage);
    const spdMult = UPGRADE_MULTIPLIERS.speed(custom.upgrades.speed);
    const radMult = UPGRADE_MULTIPLIERS.radius(custom.upgrades.radius);

    const ballRadius = 0.25 * Math.pow(radMult, 0.3);
    const ballMass = 15 * dmgMult;

    const appearance = custom.appearance;
    const geometry = new THREE.SphereGeometry(ballRadius, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      metalness: 0.95,
      roughness: 0.15,
      emissive: appearance.glowColor,
      emissiveIntensity: appearance.effectType !== 'none' ? 0.4 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(startPos);
    scene.add(mesh);

    const trailGeo = new THREE.SphereGeometry(ballRadius * 0.6, 12, 12);
    const trailMat = new THREE.MeshBasicMaterial({
      color: appearance.trailColor,
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    mesh.add(trail);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.2, restitution: 0.6 }),
    });
    (body as any).userData = { isProjectile: true };

    const speed = 55 * spdMult;
    body.velocity.set(
      direction.x * speed,
      direction.y * speed,
      direction.z * speed
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );

    addPhysicsBody(id, body);

    projectilesRef.current.set(id, {
      id,
      type: 'steelBall',
      mesh,
      body,
      life: 8,
    });

    recoilTargetRef.current = 0.3;
    muzzleFlashRef.current = 0.2;
  }, [camera, addPhysicsBody, scene]);

  const fireExplosive = useCallback(() => {
    const id = `explosive_${Date.now()}_${Math.random()}`;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(2));

    const custom = useGameStore.getState().weaponCustomizations.explosive;
    const dmgMult = UPGRADE_MULTIPLIERS.damage(custom.upgrades.damage);
    const spdMult = UPGRADE_MULTIPLIERS.speed(custom.upgrades.speed);
    const radMult = UPGRADE_MULTIPLIERS.radius(custom.upgrades.radius);

    const ballRadius = 0.2 * Math.pow(radMult, 0.3);
    const ballMass = 5 * dmgMult;

    const appearance = custom.appearance;
    const geometry = new THREE.SphereGeometry(ballRadius, 20, 20);
    const material = new THREE.MeshStandardMaterial({
      color: appearance.mainColor,
      emissive: appearance.glowColor,
      emissiveIntensity: appearance.effectType !== 'none' ? 0.7 : 0.5,
      metalness: 0.5,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(startPos);
    scene.add(mesh);

    const fuseGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.15, 8);
    const fuseMat = new THREE.MeshStandardMaterial({
      color: '#333333',
      emissive: appearance.trailColor,
      emissiveIntensity: 1,
    });
    const fuse = new THREE.Mesh(fuseGeo, fuseMat);
    fuse.position.y = ballRadius + 0.07;
    mesh.add(fuse);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.5, restitution: 0.2 }),
    });
    (body as any).userData = { isProjectile: true };

    const speed = 35 * spdMult;
    body.velocity.set(
      direction.x * speed,
      direction.y * speed + 5,
      direction.z * speed
    );

    addPhysicsBody(id, body);

    projectilesRef.current.set(id, {
      id,
      type: 'explosive',
      mesh,
      body,
      life: 10,
      exploded: false,
    });

    recoilTargetRef.current = 0.4;
    muzzleFlashRef.current = 0.3;
  }, [camera, addPhysicsBody, scene]);

  useEffect(() => {
    if (weapon !== lastWeaponRef.current) {
      lastWeaponRef.current = weapon;
      if (weapon !== 'wreckingBall') {
        createLauncher(weapon);
      } else if (launcherRef.current) {
        if (launcherRef.current.parent) {
          launcherRef.current.parent.remove(launcherRef.current);
        }
        launcherRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        launcherRef.current = null;
        launcherMatsRef.current = {};
      }
    } else {
      updateLauncherAppearance();
    }
  }, [weapon, createLauncher, updateLauncherAppearance]);

  useEffect(() => {
    if (rebuildCounter === 0) return;
    removeWreckingBall();
    const t = setTimeout(() => {
      if (useGameStore.getState().weapon === 'wreckingBall') {
        createWreckingBall();
      }
    }, 100);
    return () => clearTimeout(t);
  }, [rebuildCounter, removeWreckingBall, createWreckingBall]);

  useEffect(() => {
    if (weapon === 'wreckingBall' && !wreckingBallActive) {
      createWreckingBall();
    } else if (weapon !== 'wreckingBall' && wreckingBallActive) {
      removeWreckingBall();
    }
  }, [weapon, wreckingBallActive, createWreckingBall, removeWreckingBall]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || shootCooldown) return;

      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) return;

      if (weapon === 'steelBall') {
        fireSteelBall();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.15;
      } else if (weapon === 'explosive') {
        fireExplosive();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.8;
      } else if (weapon === 'wreckingBall') {
        if (wreckingBallRef.current && !wreckingBallRef.current.isDragging) {
          wreckingBallRef.current.isDragging = true;
          wreckingBallRef.current.dragStartPos.set(
            e.clientX,
            e.clientY,
            0
          );
          const aimLine = wreckingBallRef.current.aimLine;
          (aimLine.material as THREE.LineDashedMaterial).opacity = 0.8;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (weapon === 'wreckingBall' && wreckingBallRef.current?.isDragging) {
        const dx = (e.clientX - wreckingBallRef.current.dragStartPos.x);
        const dy = (e.clientY - wreckingBallRef.current.dragStartPos.y);

        const ballBody = wreckingBallRef.current.ballBody;
        const ballPos = new THREE.Vector3(
          ballBody.position.x,
          ballBody.position.y,
          ballBody.position.z
        );

        const aimEnd = ballPos.clone();
        aimEnd.x += dx * 0.03;
        aimEnd.y -= dy * 0.02;
        aimEnd.z += dy * 0.02;

        const points = [ballPos, aimEnd];
        wreckingBallRef.current.aimLine.geometry.setFromPoints(points);
        wreckingBallRef.current.aimLine.computeLineDistances();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (weapon === 'wreckingBall' && wreckingBallRef.current?.isDragging) {
        const dx = (e.clientX - wreckingBallRef.current.dragStartPos.x);
        const dy = (e.clientY - wreckingBallRef.current.dragStartPos.y);

        const gravityDir = useGameStore.getState().gravityDirection;
        const gravVec = GRAVITY_VECTORS[gravityDir];
        const antiGrav = new THREE.Vector3(-gravVec[0], -gravVec[1], -gravVec[2]).normalize();

        const custom = useGameStore.getState().weaponCustomizations.wreckingBall;
        const spdMult = UPGRADE_MULTIPLIERS.speed(custom.upgrades.speed);

        const impulseX = dx * 15 * spdMult + antiGrav.x * 50;
        const impulseZ = -dy * 12 * spdMult + antiGrav.z * 50;
        const impulseY = antiGrav.y * 100 + Math.max(0, -dy * 8 * spdMult);

        wreckingBallRef.current.ballBody.wakeUp();
        wreckingBallRef.current.ballBody.applyImpulse(
          new CANNON.Vec3(impulseX, impulseY, impulseZ),
          wreckingBallRef.current.ballBody.position
        );

        wreckingBallRef.current.isDragging = false;
        (wreckingBallRef.current.aimLine.material as THREE.LineDashedMaterial).opacity = 0;
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [weapon, shootCooldown, fireSteelBall, fireExplosive, setShootCooldown]);

  useFrame((_, delta) => {
    weaponCustomizationsRef.current = useGameStore.getState().weaponCustomizations;
    if (weapon !== 'wreckingBall') {
      const curCustom = weaponCustomizationsRef.current[weapon];
      const newHash = `${curCustom.appearance.mainColor}|${curCustom.appearance.trailColor}|${curCustom.appearance.glowColor}|${curCustom.appearance.effectType}`;
      if (newHash !== lastAppearanceHashRef.current) {
        lastAppearanceHashRef.current = newHash;
        updateLauncherAppearance();
      }
    }

    if (cooldownTimerRef.current > 0) {
      cooldownTimerRef.current -= delta;
      if (cooldownTimerRef.current <= 0) {
        setShootCooldown(false);
      }
    }

    if (launcherRef.current) {
      launcherRecoilRef.current += (recoilTargetRef.current - launcherRecoilRef.current) * delta * 15;
      recoilTargetRef.current *= Math.pow(0.01, delta);

      launcherRef.current.position.z = -0.5 + launcherRecoilRef.current;

      if (muzzleFlashRef.current > 0) {
        muzzleFlashRef.current -= delta;
        const muzzleFlash = launcherRef.current.getObjectByName('muzzleFlash') as THREE.Mesh;
        if (muzzleFlash && muzzleFlash.material instanceof THREE.MeshBasicMaterial) {
          muzzleFlash.material.opacity = Math.max(0, muzzleFlashRef.current / 0.2);
          muzzleFlash.scale.setScalar(1 + (1 - muzzleFlash.material.opacity) * 2);
        }
      }

      const bobOffset = Math.sin(performance.now() * 0.002) * 0.005;
      launcherRef.current.position.y = -0.2 + bobOffset;
    }

    if (wreckingBallRef.current && wreckingBallGroupRef.current) {
      const { ballBody, ballMesh, chainPoints, anchorBody, aimLine } = wreckingBallRef.current;
      const group = wreckingBallGroupRef.current;

      if (!wreckingBallRef.current.constraintAdded) {
        if (addConstraint(wreckingBallRef.current.constraint)) {
          wreckingBallRef.current.constraintAdded = true;
        }
      }

      ballMesh.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
      ballMesh.quaternion.set(
        ballBody.quaternion.x,
        ballBody.quaternion.y,
        ballBody.quaternion.z,
        ballBody.quaternion.w
      );

      const chainSegments = chainPoints.length;
      const ballPos = new THREE.Vector3(
        ballBody.position.x,
        ballBody.position.y,
        ballBody.position.z
      );
      const anchorPos = new THREE.Vector3(
        anchorBody.position.x,
        anchorBody.position.y,
        anchorBody.position.z
      );

      for (let i = 0; i < chainSegments; i++) {
        const t = (i + 1) / (chainSegments + 1);
        chainPoints[i].lerpVectors(anchorPos, ballPos, t);
        chainPoints[i].y -= Math.sin(t * Math.PI) * 0.3;

        const link = group.children.find(
          (c) => (c as THREE.Mesh).userData.chainIndex === i
        ) as THREE.Mesh | undefined;

        if (link) {
          link.position.copy(chainPoints[i]);
          const nextPoint = i === chainSegments - 1 ? ballPos : chainPoints[i + 1];
          const prevPoint = i === 0 ? anchorPos : chainPoints[i - 1];
          const direction = new THREE.Vector3()
            .subVectors(nextPoint, prevPoint)
            .normalize();
          link.up.copy(direction);
          link.scale.y = anchorPos.distanceTo(ballPos) / (chainSegments + 1);
        }
      }

      if (wreckingBallRef.current.isDragging) {
        const hue = (performance.now() * 0.001) % 1;
        (aimLine.material as THREE.LineDashedMaterial).color.setHSL(hue, 1, 0.6);
      }

      if (wreckingBallRef.current.ballMesh.material instanceof THREE.MeshStandardMaterial) {
        const custom = useGameStore.getState().weaponCustomizations.wreckingBall;
        if (custom.appearance.effectType !== 'none') {
          const effectIntensity = 0.2 + (custom.upgrades.damage - 1) * 0.08;
          wreckingBallRef.current.ballMesh.material.emissiveIntensity =
            effectIntensity * (0.6 + Math.sin(performance.now() * 0.005) * 0.4);
        }
      }
    }

    const projectilesToRemove: string[] = [];

    projectilesRef.current.forEach((projectile, id) => {
      const body = getPhysicsBody(id);
      if (!body) {
        projectilesToRemove.push(id);
        return;
      }

      projectile.life -= delta;
      projectile.mesh.position.set(body.position.x, body.position.y, body.position.z);
      projectile.mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );

      if (projectile.type === 'steelBall') {
        const trail = projectile.mesh.children[0] as THREE.Mesh;
        if (trail && trail.material instanceof THREE.MeshBasicMaterial) {
          trail.material.opacity = Math.min(1, body.velocity.length() / 30) * 0.8;
          trail.scale.setScalar(0.5 + body.velocity.length() / 60);
        }

        const custom = useGameStore.getState().weaponCustomizations.steelBall;
        if (custom.appearance.effectType !== 'none') {
          const effectIntensity = 0.3 + (custom.upgrades.damage - 1) * 0.1;
          if (projectile.mesh.material instanceof THREE.MeshStandardMaterial) {
            projectile.mesh.material.emissiveIntensity = effectIntensity * (0.5 + Math.sin(performance.now() * 0.01) * 0.5);
          }
        }
      }

      if (projectile.type === 'explosive' && !projectile.exploded) {
        const impactVelocity = body.velocity.length();
        if (impactVelocity < 8 && projectile.life < 9) {
          projectile.exploded = true;
          const custom = useGameStore.getState().weaponCustomizations.explosive;
          const radMult = UPGRADE_MULTIPLIERS.radius(custom.upgrades.radius);
          const dmgMult = UPGRADE_MULTIPLIERS.damage(custom.upgrades.damage);
          const pos: [number, number, number] = [
            body.position.x,
            body.position.y,
            body.position.z,
          ];
          applyExplosion(pos, 8 * radMult, 15000 * dmgMult);
          onExplosion(pos, 8 * radMult);
          projectile.life = 0.1;
        }

        const fuse = projectile.mesh.children[0] as THREE.Mesh;
        if (fuse && fuse.material instanceof THREE.MeshStandardMaterial) {
          fuse.material.emissiveIntensity = 0.8 + Math.sin(performance.now() * 0.02) * 0.5;
        }
      }

      if (projectile.life <= 0) {
        projectilesToRemove.push(id);
      }
    });

    projectilesToRemove.forEach((id) => {
      const projectile = projectilesRef.current.get(id);
      if (projectile) {
        scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        if (Array.isArray(projectile.mesh.material)) {
          projectile.mesh.material.forEach((m) => m.dispose());
        } else {
          projectile.mesh.material.dispose();
        }
        removePhysicsBody(id);
        projectilesRef.current.delete(id);
      }
    });
  });

  return null;
}

export function WeaponAimIndicator() {
  const weapon = useGameStore((s) => s.weapon);
  const { camera, scene } = useThree();
  const lineRef = useRef<THREE.Line | null>(null);

  useFrame(() => {
    if (weapon === 'wreckingBall') {
      if (lineRef.current) {
        scene.remove(lineRef.current);
        lineRef.current.geometry.dispose();
        (lineRef.current.material as THREE.LineBasicMaterial).dispose();
        lineRef.current = null;
      }
      return;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(1.5));

    const endPos = startPos.clone().add(direction.clone().multiplyScalar(100));
    const points = [startPos, endPos];

    if (!lineRef.current) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: weapon === 'explosive' ? '#ff3300' : '#00ff88',
        transparent: true,
        opacity: 0.5,
        dashSize: 0.5,
        gapSize: 0.3,
      });
      lineRef.current = new THREE.Line(geometry, material);
      lineRef.current.computeLineDistances();
      scene.add(lineRef.current);
    } else {
      lineRef.current.geometry.setFromPoints(points);
      lineRef.current.computeLineDistances();
    }
  });

  return null;
}

export default WeaponSystem;
