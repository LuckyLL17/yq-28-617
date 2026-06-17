import { describe, it, expect } from 'vitest';
import {
  GRAVITY_VECTORS,
  GRAVITY_LABELS,
  UPGRADE_MULTIPLIERS,
  UPGRADE_MAX_LEVEL,
  materialProperties,
  MAX_UNDO_STEPS,
  WEAPON_DEFAULTS,
  EFFECT_TYPE_LABELS,
  EFFECT_COLORS,
  generateId,
  type GravityDirection,
  type WeaponUpgradeKey,
  type MaterialType,
  type WeaponEffectType,
} from '@/store/gameStore';

describe('gameStore - GRAVITY_VECTORS', () => {
  it('应该包含所有 6 个重力方向', () => {
    const directions = Object.keys(GRAVITY_VECTORS) as GravityDirection[];
    expect(directions).toHaveLength(6);
    expect(directions).toContain('down');
    expect(directions).toContain('up');
    expect(directions).toContain('left');
    expect(directions).toContain('right');
    expect(directions).toContain('forward');
    expect(directions).toContain('backward');
  });

  it('每个方向应该是三维向量', () => {
    Object.values(GRAVITY_VECTORS).forEach((vec) => {
      expect(vec).toHaveLength(3);
      expect(typeof vec[0]).toBe('number');
      expect(typeof vec[1]).toBe('number');
      expect(typeof vec[2]).toBe('number');
    });
  });

  it('向下重力应该是负 Y 方向', () => {
    expect(GRAVITY_VECTORS.down[0]).toBe(0);
    expect(GRAVITY_VECTORS.down[1]).toBe(-30);
    expect(GRAVITY_VECTORS.down[2]).toBe(0);
  });

  it('向上重力应该是正 Y 方向', () => {
    expect(GRAVITY_VECTORS.up[0]).toBe(0);
    expect(GRAVITY_VECTORS.up[1]).toBe(30);
    expect(GRAVITY_VECTORS.up[2]).toBe(0);
  });

  it('向左重力应该是负 X 方向', () => {
    expect(GRAVITY_VECTORS.left[0]).toBe(-30);
    expect(GRAVITY_VECTORS.left[1]).toBe(0);
    expect(GRAVITY_VECTORS.left[2]).toBe(0);
  });

  it('向右重力应该是正 X 方向', () => {
    expect(GRAVITY_VECTORS.right[0]).toBe(30);
    expect(GRAVITY_VECTORS.right[1]).toBe(0);
    expect(GRAVITY_VECTORS.right[2]).toBe(0);
  });

  it('向前重力应该是正 Z 方向', () => {
    expect(GRAVITY_VECTORS.forward[0]).toBe(0);
    expect(GRAVITY_VECTORS.forward[1]).toBe(0);
    expect(GRAVITY_VECTORS.forward[2]).toBe(30);
  });

  it('向后重力应该是负 Z 方向', () => {
    expect(GRAVITY_VECTORS.backward[0]).toBe(0);
    expect(GRAVITY_VECTORS.backward[1]).toBe(0);
    expect(GRAVITY_VECTORS.backward[2]).toBe(-30);
  });

  it('所有重力向量的大小应该相同', () => {
    const magnitude = (vec: [number, number, number]) =>
      Math.sqrt(vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2);

    const magnitudes = Object.values(GRAVITY_VECTORS).map(magnitude);
    const firstMagnitude = magnitudes[0];

    magnitudes.forEach((m) => {
      expect(m).toBeCloseTo(firstMagnitude);
    });
  });
});

describe('gameStore - GRAVITY_LABELS', () => {
  it('应该为每个重力方向提供标签', () => {
    const directions = Object.keys(GRAVITY_VECTORS) as GravityDirection[];
    directions.forEach((dir) => {
      expect(GRAVITY_LABELS[dir]).toBeDefined();
      expect(typeof GRAVITY_LABELS[dir]).toBe('string');
      expect(GRAVITY_LABELS[dir].length).toBeGreaterThan(0);
    });
  });
});

describe('gameStore - UPGRADE_MULTIPLIERS', () => {
  const upgradeKeys = Object.keys(UPGRADE_MULTIPLIERS) as WeaponUpgradeKey[];

  it('应该包含所有升级类型', () => {
    expect(upgradeKeys).toHaveLength(3);
    expect(upgradeKeys).toContain('damage');
    expect(upgradeKeys).toContain('speed');
    expect(upgradeKeys).toContain('radius');
  });

  it('等级 1 时倍率应该为 1', () => {
    upgradeKeys.forEach((key) => {
      expect(UPGRADE_MULTIPLIERS[key](1)).toBe(1);
    });
  });

  it('倍率应该随等级递增', () => {
    upgradeKeys.forEach((key) => {
      for (let level = 1; level < UPGRADE_MAX_LEVEL; level++) {
        expect(UPGRADE_MULTIPLIERS[key](level + 1)).toBeGreaterThan(
          UPGRADE_MULTIPLIERS[key](level)
        );
      }
    });
  });

  it('伤害倍率应该按 0.4 递增', () => {
    expect(UPGRADE_MULTIPLIERS.damage(1)).toBe(1);
    expect(UPGRADE_MULTIPLIERS.damage(2)).toBeCloseTo(1.4);
    expect(UPGRADE_MULTIPLIERS.damage(3)).toBeCloseTo(1.8);
    expect(UPGRADE_MULTIPLIERS.damage(4)).toBeCloseTo(2.2);
    expect(UPGRADE_MULTIPLIERS.damage(5)).toBeCloseTo(2.6);
  });

  it('速度倍率应该按 0.25 递增', () => {
    expect(UPGRADE_MULTIPLIERS.speed(1)).toBe(1);
    expect(UPGRADE_MULTIPLIERS.speed(2)).toBeCloseTo(1.25);
    expect(UPGRADE_MULTIPLIERS.speed(3)).toBeCloseTo(1.5);
    expect(UPGRADE_MULTIPLIERS.speed(4)).toBeCloseTo(1.75);
    expect(UPGRADE_MULTIPLIERS.speed(5)).toBeCloseTo(2);
  });

  it('范围倍率应该按 0.3 递增', () => {
    expect(UPGRADE_MULTIPLIERS.radius(1)).toBe(1);
    expect(UPGRADE_MULTIPLIERS.radius(2)).toBeCloseTo(1.3);
    expect(UPGRADE_MULTIPLIERS.radius(3)).toBeCloseTo(1.6);
    expect(UPGRADE_MULTIPLIERS.radius(4)).toBeCloseTo(1.9);
    expect(UPGRADE_MULTIPLIERS.radius(5)).toBeCloseTo(2.2);
  });
});

describe('gameStore - materialProperties', () => {
  const materials = Object.keys(materialProperties) as MaterialType[];

  it('应该包含所有材料类型', () => {
    expect(materials).toHaveLength(3);
    expect(materials).toContain('wood');
    expect(materials).toContain('glass');
    expect(materials).toContain('concrete');
  });

  it('每种材料应该有颜色、生命值和密度属性', () => {
    materials.forEach((material) => {
      const props = materialProperties[material];
      expect(props.color).toBeDefined();
      expect(typeof props.color).toBe('string');
      expect(props.health).toBeDefined();
      expect(typeof props.health).toBe('number');
      expect(props.health).toBeGreaterThan(0);
      expect(props.density).toBeDefined();
      expect(typeof props.density).toBe('number');
      expect(props.density).toBeGreaterThan(0);
    });
  });

  it('混凝土应该有最高的生命值', () => {
    expect(materialProperties.concrete.health).toBeGreaterThan(
      materialProperties.wood.health
    );
    expect(materialProperties.concrete.health).toBeGreaterThan(
      materialProperties.glass.health
    );
  });

  it('玻璃应该有最低的生命值', () => {
    expect(materialProperties.glass.health).toBeLessThan(
      materialProperties.wood.health
    );
    expect(materialProperties.glass.health).toBeLessThan(
      materialProperties.concrete.health
    );
  });

  it('每种材料应该有 emissive 属性', () => {
    materials.forEach((material) => {
      expect(materialProperties[material].emissive).toBeDefined();
    });
  });
});

describe('gameStore - WEAPON_DEFAULTS', () => {
  it('应该包含所有 4 种武器的默认配置', () => {
    const weapons = Object.keys(WEAPON_DEFAULTS);
    expect(weapons).toHaveLength(4);
    expect(weapons).toContain('wreckingBall');
    expect(weapons).toContain('steelBall');
    expect(weapons).toContain('explosive');
    expect(weapons).toContain('sprayPaint');
  });

  it('每种武器应该有升级和外观配置', () => {
    Object.values(WEAPON_DEFAULTS).forEach((config) => {
      expect(config.upgrades).toBeDefined();
      expect(config.upgrades.damage).toBe(1);
      expect(config.upgrades.speed).toBe(1);
      expect(config.upgrades.radius).toBe(1);
      expect(config.appearance).toBeDefined();
      expect(typeof config.appearance.mainColor).toBe('string');
      expect(typeof config.appearance.trailColor).toBe('string');
      expect(typeof config.appearance.glowColor).toBe('string');
      expect(config.appearance.effectType).toBe('none');
    });
  });
});

describe('gameStore - EFFECT_TYPE_LABELS', () => {
  it('应该包含所有特效类型的标签', () => {
    const effectTypes = Object.keys(EFFECT_TYPE_LABELS) as WeaponEffectType[];
    expect(effectTypes).toHaveLength(5);
    expect(effectTypes).toContain('none');
    expect(effectTypes).toContain('fire');
    expect(effectTypes).toContain('electric');
    expect(effectTypes).toContain('rainbow');
    expect(effectTypes).toContain('shadow');
  });
});

describe('gameStore - EFFECT_COLORS', () => {
  it('应该为每种特效提供主色、轨迹色和辉光色', () => {
    Object.values(EFFECT_COLORS).forEach((colors) => {
      expect(colors.main).toBeDefined();
      expect(typeof colors.main).toBe('string');
      expect(colors.trail).toBeDefined();
      expect(typeof colors.trail).toBe('string');
      expect(colors.glow).toBeDefined();
      expect(typeof colors.glow).toBe('string');
    });
  });

  it('none 特效的颜色应该为空字符串', () => {
    expect(EFFECT_COLORS.none.main).toBe('');
    expect(EFFECT_COLORS.none.trail).toBe('');
    expect(EFFECT_COLORS.none.glow).toBe('');
  });
});

describe('gameStore - generateId', () => {
  it('应该生成字符串类型的 ID', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('应该生成不同的 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('生成的 ID 应该只包含小写字母和数字', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('gameStore - 常量值', () => {
  it('UPGRADE_MAX_LEVEL 应该为 5', () => {
    expect(UPGRADE_MAX_LEVEL).toBe(5);
  });

  it('MAX_UNDO_STEPS 应该为 50', () => {
    expect(MAX_UNDO_STEPS).toBe(50);
  });
});
