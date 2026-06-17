import type { RoboticArmState } from '../../store/gameStore';

const DEFAULT_ROBOTIC_ARM: RoboticArmState = {
  baseAngle: 0,
  shoulderAngle: -Math.PI / 4,
  elbowAngle: Math.PI / 2,
  wristAngle: 0,
  gripperOpen: true,
  isGrabbing: false,
  grabbedBlockId: null,
};

export function setRoboticArmField<K extends keyof RoboticArmState>(
  arm: RoboticArmState,
  key: K,
  value: RoboticArmState[K]
): RoboticArmState {
  return { ...arm, [key]: value };
}

export function resetRoboticArm(): RoboticArmState {
  return { ...DEFAULT_ROBOTIC_ARM };
}

export { DEFAULT_ROBOTIC_ARM };
