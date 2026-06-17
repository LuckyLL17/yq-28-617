import { describe, it, expect } from 'vitest';
import {
  calculateExplosionImpulse,
  clampDeltaTime,
  clampSpraySize,
  MAX_DELTA_TIME,
} from '@/lib/physicsUtils';

describe('physicsUtils - calculateExplosionImpulse', () => {
  const explosionPos: [number, number, number] = [0, 0, 0];

  it('应该在爆炸半径内返回正确的冲量方向', () => {
    const bodyPos: [number, number, number] = [5, 0, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(true);
    expect(result.impulseX).toBeGreaterThan(0);
    expect(result.impulseY).toBeCloseTo(0);
    expect(result.impulseZ).toBeCloseTo(0);
  });

  it('应该在超出爆炸半径时返回 shouldApply = false', () => {
    const bodyPos: [number, number, number] = [15, 0, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(false);
    expect(result.impulseX).toBe(0);
    expect(result.impulseY).toBe(0);
    expect(result.impulseZ).toBe(0);
  });

  it('应该在距离为 0 时返回 shouldApply = false', () => {
    const bodyPos: [number, number, number] = [0, 0, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(false);
  });

  it('应该在距离非常近时返回更大的冲量', () => {
    const nearPos: [number, number, number] = [1, 0, 0];
    const farPos: [number, number, number] = [8, 0, 0];

    const nearResult = calculateExplosionImpulse(nearPos, explosionPos, 10, 100);
    const farResult = calculateExplosionImpulse(farPos, explosionPos, 10, 100);

    expect(nearResult.impulseX).toBeGreaterThan(farResult.impulseX);
  });

  it('应该具有线性衰减效果', () => {
    const radius = 10;
    const force = 100;

    const quarterPos: [number, number, number] = [2.5, 0, 0];
    const halfPos: [number, number, number] = [5, 0, 0];
    const threeQuarterPos: [number, number, number] = [7.5, 0, 0];

    const quarterResult = calculateExplosionImpulse(quarterPos, explosionPos, radius, force);
    const halfResult = calculateExplosionImpulse(halfPos, explosionPos, radius, force);
    const threeQuarterResult = calculateExplosionImpulse(threeQuarterPos, explosionPos, radius, force);

    const quarterMagnitude = Math.abs(quarterResult.impulseX);
    const halfMagnitude = Math.abs(halfResult.impulseX);
    const threeQuarterMagnitude = Math.abs(threeQuarterResult.impulseX);

    expect(quarterMagnitude).toBeCloseTo(force * 0.75);
    expect(halfMagnitude).toBeCloseTo(force * 0.5);
    expect(threeQuarterMagnitude).toBeCloseTo(force * 0.25);
  });

  it('应该在三维空间中正确计算对角线方向的冲量', () => {
    const bodyPos: [number, number, number] = [3, 4, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(true);

    const dist = 5;
    const falloff = 1 - dist / 10;
    const expectedMagnitude = 100 * falloff;
    const actualMagnitude = Math.sqrt(
      result.impulseX ** 2 + result.impulseY ** 2 + result.impulseZ ** 2
    );

    expect(actualMagnitude).toBeCloseTo(expectedMagnitude);
    expect(result.impulseX / result.impulseY).toBeCloseTo(3 / 4);
  });

  it('应该在爆炸中心正上方时返回向上的冲量', () => {
    const bodyPos: [number, number, number] = [0, 5, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(true);
    expect(result.impulseX).toBeCloseTo(0);
    expect(result.impulseY).toBeGreaterThan(0);
    expect(result.impulseZ).toBeCloseTo(0);
  });

  it('应该在爆炸中心正前方时返回向前的冲量', () => {
    const bodyPos: [number, number, number] = [0, 0, 5];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(true);
    expect(result.impulseX).toBeCloseTo(0);
    expect(result.impulseY).toBeCloseTo(0);
    expect(result.impulseZ).toBeGreaterThan(0);
  });

  it('应该在距离正好等于半径时返回 shouldApply = false', () => {
    const bodyPos: [number, number, number] = [10, 0, 0];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(false);
  });

  it('应该正确处理负坐标位置', () => {
    const bodyPos: [number, number, number] = [-5, -3, -2];
    const result = calculateExplosionImpulse(bodyPos, explosionPos, 10, 100);

    expect(result.shouldApply).toBe(true);
    expect(result.impulseX).toBeLessThan(0);
    expect(result.impulseY).toBeLessThan(0);
    expect(result.impulseZ).toBeLessThan(0);
  });
});

describe('physicsUtils - clampDeltaTime', () => {
  it('应该返回不超过 MAX_DELTA_TIME 的值', () => {
    expect(clampDeltaTime(1)).toBe(MAX_DELTA_TIME);
    expect(clampDeltaTime(0.1)).toBe(MAX_DELTA_TIME);
  });

  it('应该返回原始值如果小于 MAX_DELTA_TIME', () => {
    const smallDelta = 1 / 120;
    expect(clampDeltaTime(smallDelta)).toBe(smallDelta);
  });

  it('应该在等于 MAX_DELTA_TIME 时返回原值', () => {
    expect(clampDeltaTime(MAX_DELTA_TIME)).toBe(MAX_DELTA_TIME);
  });

  it('应该处理 0 值', () => {
    expect(clampDeltaTime(0)).toBe(0);
  });

  it('应该处理负值', () => {
    expect(clampDeltaTime(-1)).toBe(-1);
  });
});

describe('physicsUtils - clampSpraySize', () => {
  it('应该在默认范围内限制大小', () => {
    expect(clampSpraySize(100)).toBe(80);
    expect(clampSpraySize(1)).toBe(5);
  });

  it('应该在范围内时返回原始值', () => {
    expect(clampSpraySize(20)).toBe(20);
    expect(clampSpraySize(50)).toBe(50);
  });

  it('应该在等于边界值时返回原值', () => {
    expect(clampSpraySize(5)).toBe(5);
    expect(clampSpraySize(80)).toBe(80);
  });

  it('应该支持自定义最小值和最大值', () => {
    expect(clampSpraySize(1, 10, 50)).toBe(10);
    expect(clampSpraySize(100, 10, 50)).toBe(50);
    expect(clampSpraySize(30, 10, 50)).toBe(30);
  });
});
