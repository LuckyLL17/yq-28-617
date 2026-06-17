import { describe, it, expect } from 'vitest';
import {
  setRoboticArmField,
  resetRoboticArm,
  DEFAULT_ROBOTIC_ARM,
} from '@/ecs/systems/roboticArm';
import type { RoboticArmState } from '@/store/gameStore';

describe('roboticArm system - DEFAULT_ROBOTIC_ARM', () => {
  it('应该有正确的默认角度值', () => {
    expect(DEFAULT_ROBOTIC_ARM.baseAngle).toBe(0);
    expect(DEFAULT_ROBOTIC_ARM.shoulderAngle).toBe(-Math.PI / 4);
    expect(DEFAULT_ROBOTIC_ARM.elbowAngle).toBe(Math.PI / 2);
    expect(DEFAULT_ROBOTIC_ARM.wristAngle).toBe(0);
  });

  it('应该有正确的默认状态', () => {
    expect(DEFAULT_ROBOTIC_ARM.gripperOpen).toBe(true);
    expect(DEFAULT_ROBOTIC_ARM.isGrabbing).toBe(false);
    expect(DEFAULT_ROBOTIC_ARM.grabbedBlockId).toBeNull();
  });
});

describe('roboticArm system - setRoboticArmField', () => {
  const createInitialState = (): RoboticArmState => ({ ...DEFAULT_ROBOTIC_ARM });

  it('应该设置 baseAngle', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'baseAngle', Math.PI / 2);

    expect(result.baseAngle).toBe(Math.PI / 2);
  });

  it('应该设置 shoulderAngle', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'shoulderAngle', 0);

    expect(result.shoulderAngle).toBe(0);
  });

  it('应该设置 elbowAngle', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'elbowAngle', Math.PI);

    expect(result.elbowAngle).toBe(Math.PI);
  });

  it('应该设置 wristAngle', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'wristAngle', -Math.PI / 3);

    expect(result.wristAngle).toBe(-Math.PI / 3);
  });

  it('应该设置 gripperOpen', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'gripperOpen', false);

    expect(result.gripperOpen).toBe(false);
  });

  it('应该设置 isGrabbing', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'isGrabbing', true);

    expect(result.isGrabbing).toBe(true);
  });

  it('应该设置 grabbedBlockId', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'grabbedBlockId', 'block-123');

    expect(result.grabbedBlockId).toBe('block-123');
  });

  it('不应该修改原始状态对象', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'baseAngle', Math.PI);

    expect(state.baseAngle).toBe(0);
    expect(result).not.toBe(state);
  });

  it('不应该影响其他字段', () => {
    const state = createInitialState();
    const result = setRoboticArmField(state, 'baseAngle', Math.PI);

    expect(result.shoulderAngle).toBe(state.shoulderAngle);
    expect(result.elbowAngle).toBe(state.elbowAngle);
    expect(result.wristAngle).toBe(state.wristAngle);
    expect(result.gripperOpen).toBe(state.gripperOpen);
    expect(result.isGrabbing).toBe(state.isGrabbing);
    expect(result.grabbedBlockId).toBe(state.grabbedBlockId);
  });

  it('应该支持链式调用', () => {
    const state = createInitialState();
    const result = setRoboticArmField(
      setRoboticArmField(state, 'baseAngle', 1),
      'shoulderAngle',
      2
    );

    expect(result.baseAngle).toBe(1);
    expect(result.shoulderAngle).toBe(2);
  });
});

describe('roboticArm system - resetRoboticArm', () => {
  it('应该返回默认状态', () => {
    const result = resetRoboticArm();
    expect(result).toEqual(DEFAULT_ROBOTIC_ARM);
  });

  it('每次调用应该返回新的对象', () => {
    const result1 = resetRoboticArm();
    const result2 = resetRoboticArm();

    expect(result1).not.toBe(result2);
  });

  it('修改返回值不应该影响默认状态', () => {
    const result = resetRoboticArm();
    result.baseAngle = 999;

    const freshResult = resetRoboticArm();
    expect(freshResult.baseAngle).toBe(0);
  });
});
