import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, BlockData, GravityDirection, materialProperties, generateId } from '@/store/gameStore';

const BASE_HEIGHT = 1.5;
const BASE_RADIUS = 1.2;
const UPPER_ARM_LENGTH = 4;
const UPPER_ARM_WIDTH = 0.6;
const FOREARM_LENGTH = 3.5;
const FOREARM_WIDTH = 0.5;
const WRIST_LENGTH = 0.8;
const WRIST_WIDTH = 0.4;
const GRIPPER_LENGTH = 0.6;
const GRIPPER_WIDTH = 0.2;
const GRIPPER_MAX_OPEN = 0.9;
const GRIPPER_MIN_OPEN = 0.18;

const BASE_ANGLE_SPEED = 1.5;
const SHOULDER_ANGLE_SPEED = 1.2;
const ELBOW_ANGLE_SPEED = 1.5;
const WRIST_ANGLE_SPEED = 2;

interface RoboticArmProps {
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
}

export function RoboticArm({
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
}: RoboticArmProps) {
  const roboticArm = useGameStore((s) => s.roboticArm);
  const setRoboticArmBaseAngle = useGameStore((s) => s.setRoboticArmBaseAngle);
  const setRoboticArmShoulderAngle = useGameStore((s) => s.setRoboticArmShoulderAngle);
  const setRoboticArmElbowAngle = useGameStore((s) => s.setRoboticArmElbowAngle);
  const setRoboticArmWristAngle = useGameStore((s) => s.setRoboticArmWristAngle);
  const setRoboticArmGripperOpen = useGameStore((s) => s.setRoboticArmGripperOpen);
  const setRoboticArmGrabbing = useGameStore((s) => s.setRoboticArmGrabbing);
  const setRoboticArmGrabbedBlockId = useGameStore((s) => s.setRoboticArmGrabbedBlockId);
  const resetRoboticArm = useGameStore((s) => s.resetRoboticArm);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const blocks = useGameStore((s) => s.blocks);
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);

  const armGroupRef = useRef<THREE.Group>(null);
  const baseGroupRef = useRef<THREE.Group>(null);
  const shoulderGroupRef = useRef<THREE.Group>(null);
  const upperArmRef = useRef<THREE.Mesh>(null);
  const elbowGroupRef = useRef<THREE.Group>(null);
  const forearmRef = useRef<THREE.Mesh>(null);
  const wristGroupRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Mesh>(null);
  const gripperGroupRef = useRef<THREE.Group>(null);
  const gripperLeftRef = useRef<THREE.Group>(null);
  const gripperRightRef = useRef<THREE.Group>(null);
  const gripperCenterRef = useRef<THREE.Object3D>(null);

  const lastGripperPos = useRef(new THREE.Vector3());
  const gripperVelocity = useRef(new THREE.Vector3());
  const keysPressed = useRef<Set<string>>(new Set());
  const grabbedBodyOriginalType = useRef<CANNON.BodyType | null>(null);

  const basePosition: [number, number, number] = [0, BASE_HEIGHT / 2, 8];

  const getGripperWorldPosition = useCallback(() => {
    const pos = new THREE.Vector3();
    if (gripperCenterRef.current) {
      gripperCenterRef.current.getWorldPosition(pos);
    }
    return pos;
  }, []);

  const getGripperWorldQuaternion = useCallback(() => {
    const quat = new THREE.Quaternion();
    if (gripperGroupRef.current) {
      gripperGroupRef.current.getWorldQuaternion(quat);
    }
    return quat;
  }, []);

  const handleGrab = useCallback(() => {
    const { isGrabbing, grabbedBlockId } = roboticArm;

    if (isGrabbing && grabbedBlockId) {
      const body = getPhysicsBody(grabbedBlockId);
      if (body) {
        if (grabbedBodyOriginalType.current !== null) {
          body.type = grabbedBodyOriginalType.current;
        }
        body.velocity.set(
          gripperVelocity.current.x * 1.8,
          gripperVelocity.current.y * 1.8,
          gripperVelocity.current.z * 1.8
        );
        body.angularVelocity.set(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        );
        body.wakeUp();
      }
      grabbedBodyOriginalType.current = null;
      setRoboticArmGrabbing(false);
      setRoboticArmGrabbedBlockId(null);
      setRoboticArmGripperOpen(true);
    } else {
      const gripperPos = getGripperWorldPosition();

      let nearestBlockId: string | null = null;
      let nearestDist = Infinity;

      blocks.forEach((block, id) => {
        const body = getPhysicsBody(id);
        if (!body || body.mass === 0) return;

        const blockPos = new THREE.Vector3(
          block.position[0],
          block.position[1],
          block.position[2]
        );
        const dist = gripperPos.distanceTo(blockPos);

        if (dist < 2.5 && dist < nearestDist) {
          nearestDist = dist;
          nearestBlockId = id;
        }
      });

      if (nearestBlockId) {
        const body = getPhysicsBody(nearestBlockId);
        if (body) {
          grabbedBodyOriginalType.current = body.type;
          body.type = CANNON.Body.KINEMATIC;
          body.wakeUp();

          setRoboticArmGrabbing(true);
          setRoboticArmGrabbedBlockId(nearestBlockId);
          setRoboticArmGripperOpen(false);
        }
      }
    }
  }, [
    roboticArm,
    blocks,
    getPhysicsBody,
    getGripperWorldPosition,
    setRoboticArmGrabbing,
    setRoboticArmGrabbedBlockId,
    setRoboticArmGripperOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameMode = useGameStore.getState().gameMode;
      if (gameMode !== 'roboticArm') return;

      keysPressed.current.add(e.key.toLowerCase());

      if (e.key === ' ') {
        e.preventDefault();
        handleGrab();
      }
      if (e.key === 'r' || e.key === 'R') {
        resetRoboticArm();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleGrab, resetRoboticArm]);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const { baseAngle, shoulderAngle, elbowAngle, wristAngle, isGrabbing, grabbedBlockId } = state.roboticArm;

    let newBaseAngle = baseAngle;
    let newShoulderAngle = shoulderAngle;
    let newElbowAngle = elbowAngle;
    let newWristAngle = wristAngle;

    const dt = Math.min(delta, 0.05);

    if (keysPressed.current.has('a')) {
      newBaseAngle -= BASE_ANGLE_SPEED * dt;
    }
    if (keysPressed.current.has('d')) {
      newBaseAngle += BASE_ANGLE_SPEED * dt;
    }
    if (keysPressed.current.has('w')) {
      newShoulderAngle = Math.max(-Math.PI * 0.7, newShoulderAngle - SHOULDER_ANGLE_SPEED * dt);
    }
    if (keysPressed.current.has('s')) {
      newShoulderAngle = Math.min(Math.PI * 0.3, newShoulderAngle + SHOULDER_ANGLE_SPEED * dt);
    }
    if (keysPressed.current.has('q')) {
      newElbowAngle = Math.max(0.3, newElbowAngle - ELBOW_ANGLE_SPEED * dt);
    }
    if (keysPressed.current.has('e')) {
      newElbowAngle = Math.min(Math.PI * 0.95, newElbowAngle + ELBOW_ANGLE_SPEED * dt);
    }
    if (keysPressed.current.has('z')) {
      newWristAngle -= WRIST_ANGLE_SPEED * dt;
    }
    if (keysPressed.current.has('x')) {
      newWristAngle += WRIST_ANGLE_SPEED * dt;
    }

    if (newBaseAngle !== baseAngle) setRoboticArmBaseAngle(newBaseAngle);
    if (newShoulderAngle !== shoulderAngle) setRoboticArmShoulderAngle(newShoulderAngle);
    if (newElbowAngle !== elbowAngle) setRoboticArmElbowAngle(newElbowAngle);
    if (newWristAngle !== wristAngle) setRoboticArmWristAngle(newWristAngle);

    if (baseGroupRef.current) {
      baseGroupRef.current.rotation.y = newBaseAngle;
    }
    if (shoulderGroupRef.current) {
      shoulderGroupRef.current.rotation.z = newShoulderAngle;
    }
    if (elbowGroupRef.current) {
      elbowGroupRef.current.rotation.z = newElbowAngle;
    }
    if (wristGroupRef.current) {
      wristGroupRef.current.rotation.z = newWristAngle;
    }

    const gripperOpen = state.roboticArm.gripperOpen;
    const gripperOffset = gripperOpen ? GRIPPER_MAX_OPEN : GRIPPER_MIN_OPEN;
    if (gripperLeftRef.current) {
      gripperLeftRef.current.position.x = -gripperOffset / 2;
    }
    if (gripperRightRef.current) {
      gripperRightRef.current.position.x = gripperOffset / 2;
    }

    if (gripperCenterRef.current) {
      const currentPos = new THREE.Vector3();
      gripperCenterRef.current.getWorldPosition(currentPos);

      gripperVelocity.current = currentPos.clone().sub(lastGripperPos.current).divideScalar(dt || 0.016);
      lastGripperPos.current.copy(currentPos);
    }

    if (isGrabbing && grabbedBlockId) {
      const body = getPhysicsBody(grabbedBlockId);
      if (body && gripperCenterRef.current) {
        const gripperPos = new THREE.Vector3();
        gripperCenterRef.current.getWorldPosition(gripperPos);

        const gripperQuat = new THREE.Quaternion();
        gripperGroupRef.current?.getWorldQuaternion(gripperQuat);

        const offset = new THREE.Vector3(0, 0.3, 0);
        offset.applyQuaternion(gripperQuat);
        const targetPos = gripperPos.add(offset);

        body.position.set(targetPos.x, targetPos.y, targetPos.z);
        body.quaternion.set(gripperQuat.x, gripperQuat.y, gripperQuat.z, gripperQuat.w);

        const block = blocks.get(grabbedBlockId);
        if (block) {
          updateBlockPosition(grabbedBlockId, [targetPos.x, targetPos.y, targetPos.z]);
          const euler = new THREE.Euler().setFromQuaternion(gripperQuat);
          updateBlockRotation(grabbedBlockId, [euler.x, euler.y, euler.z]);
        }
      }
    }
  });

  return (
    <group ref={armGroupRef} position={basePosition}>
      <group ref={baseGroupRef}>
        <mesh position={[0, -BASE_HEIGHT / 2 - 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[BASE_RADIUS * 1.3, BASE_RADIUS * 1.4, 0.3, 20]} />
          <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.3} />
        </mesh>

        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.1, BASE_HEIGHT, 20]} />
          <meshStandardMaterial color="#2d3748" metalness={0.7} roughness={0.4} />
        </mesh>

        <mesh position={[0, BASE_HEIGHT / 2 - 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[BASE_RADIUS * 0.85, BASE_RADIUS, 0.4, 20]} />
          <meshStandardMaterial color="#1a202c" metalness={0.9} roughness={0.2} />
        </mesh>

        <group ref={shoulderGroupRef} position={[0, BASE_HEIGHT / 2 + 0.2, 0]}>
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[UPPER_ARM_WIDTH * 0.75, 20, 20]} />
            <meshStandardMaterial color="#c53030" metalness={0.85} roughness={0.15} />
          </mesh>

          <mesh ref={upperArmRef} position={[0, UPPER_ARM_LENGTH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[UPPER_ARM_WIDTH, UPPER_ARM_LENGTH, UPPER_ARM_WIDTH]} />
            <meshStandardMaterial color="#e53e3e" metalness={0.6} roughness={0.3} />
          </mesh>

          <group ref={elbowGroupRef} position={[0, UPPER_ARM_LENGTH, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[FOREARM_WIDTH * 0.7, 20, 20]} />
              <meshStandardMaterial color="#c05621" metalness={0.85} roughness={0.15} />
            </mesh>

            <mesh ref={forearmRef} position={[0, FOREARM_LENGTH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[FOREARM_WIDTH, FOREARM_LENGTH, FOREARM_WIDTH]} />
              <meshStandardMaterial color="#dd6b20" metalness={0.6} roughness={0.3} />
            </mesh>

            <group ref={wristGroupRef} position={[0, FOREARM_LENGTH, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[WRIST_WIDTH * 0.7, 20, 20]} />
                <meshStandardMaterial color="#b7791f" metalness={0.85} roughness={0.15} />
              </mesh>

              <mesh ref={wristRef} position={[0, WRIST_LENGTH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[WRIST_WIDTH, WRIST_LENGTH, WRIST_WIDTH]} />
                <meshStandardMaterial color="#d69e2e" metalness={0.7} roughness={0.25} />
              </mesh>

              <group ref={gripperGroupRef} position={[0, WRIST_LENGTH + GRIPPER_LENGTH / 2, 0]}>
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[GRIPPER_WIDTH * 2.5, GRIPPER_WIDTH * 0.8, GRIPPER_WIDTH * 1.2]} />
                  <meshStandardMaterial color="#718096" metalness={0.8} roughness={0.2} />
                </mesh>

                <group ref={gripperLeftRef} position={[-GRIPPER_MAX_OPEN / 2, GRIPPER_LENGTH / 2, 0]}>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[GRIPPER_WIDTH, GRIPPER_LENGTH, GRIPPER_WIDTH]} />
                    <meshStandardMaterial
                      color={roboticArm.isGrabbing ? '#48bb78' : '#a0aec0'}
                      metalness={0.8}
                      roughness={0.2}
                      emissive={roboticArm.isGrabbing ? '#38a169' : '#000000'}
                      emissiveIntensity={roboticArm.isGrabbing ? 0.4 : 0}
                    />
                  </mesh>
                  <mesh position={[GRIPPER_WIDTH * 0.4, GRIPPER_LENGTH / 2 - 0.1, 0]} castShadow>
                    <boxGeometry args={[GRIPPER_WIDTH * 0.6, 0.2, GRIPPER_WIDTH * 1.4]} />
                    <meshStandardMaterial color="#4a5568" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>

                <group ref={gripperRightRef} position={[GRIPPER_MAX_OPEN / 2, GRIPPER_LENGTH / 2, 0]}>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[GRIPPER_WIDTH, GRIPPER_LENGTH, GRIPPER_WIDTH]} />
                    <meshStandardMaterial
                      color={roboticArm.isGrabbing ? '#48bb78' : '#a0aec0'}
                      metalness={0.8}
                      roughness={0.2}
                      emissive={roboticArm.isGrabbing ? '#38a169' : '#000000'}
                      emissiveIntensity={roboticArm.isGrabbing ? 0.4 : 0}
                    />
                  </mesh>
                  <mesh position={[-GRIPPER_WIDTH * 0.4, GRIPPER_LENGTH / 2 - 0.1, 0]} castShadow>
                    <boxGeometry args={[GRIPPER_WIDTH * 0.6, 0.2, GRIPPER_WIDTH * 1.4]} />
                    <meshStandardMaterial color="#4a5568" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>

                <object3D ref={gripperCenterRef} position={[0, GRIPPER_LENGTH / 2 + 0.2, 0]} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default RoboticArm;
