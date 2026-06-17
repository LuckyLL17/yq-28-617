export interface ExplosionForceResult {
  impulseX: number;
  impulseY: number;
  impulseZ: number;
  shouldApply: boolean;
}

export function calculateExplosionImpulse(
  bodyPosition: [number, number, number],
  explosionPosition: [number, number, number],
  radius: number,
  force: number
): ExplosionForceResult {
  const [bx, by, bz] = bodyPosition;
  const [ex, ey, ez] = explosionPosition;

  const dx = bx - ex;
  const dy = by - ey;
  const dz = bz - ez;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist >= radius || dist <= 0.01) {
    return { impulseX: 0, impulseY: 0, impulseZ: 0, shouldApply: false };
  }

  const falloff = 1 - dist / radius;
  const impulseMagnitude = force * falloff;
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  return {
    impulseX: nx * impulseMagnitude,
    impulseY: ny * impulseMagnitude,
    impulseZ: nz * impulseMagnitude,
    shouldApply: true,
  };
}

export const MAX_DELTA_TIME = 1 / 60;

export function clampDeltaTime(delta: number): number {
  return Math.min(MAX_DELTA_TIME, delta);
}

export function clampSpraySize(size: number, min = 5, max = 80): number {
  return Math.max(min, Math.min(max, size));
}
