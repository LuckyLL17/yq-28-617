import { describe, it, expect } from 'vitest';
import {
  upgradeWeapon,
  setWeaponAppearance,
  getWeaponUpgrade,
  getWeaponUpgradeMultiplier,
  getWeaponAppearance,
  resetWeaponCustomizations,
} from '@/ecs/systems/weapon';
import {
  WEAPON_DEFAULTS,
  UPGRADE_MAX_LEVEL,
  UPGRADE_MULTIPLIERS,
  type WeaponType,
  type WeaponUpgradeKey,
  type WeaponAppearanceKey,
  type WeaponCustomizations,
} from '@/store/gameStore';

describe('weapon system - upgradeWeapon', () => {
  const createInitialCustomizations = (): WeaponCustomizations =>
    JSON.parse(JSON.stringify(WEAPON_DEFAULTS));

  it('应该升级指定武器的指定属性', () => {
    const customizations = createInitialCustomizations();
    const result = upgradeWeapon(customizations, 'wreckingBall', 'damage');

    expect(result.wreckingBall.upgrades.damage).toBe(2);
    expect(result.wreckingBall.upgrades.speed).toBe(1);
    expect(result.wreckingBall.upgrades.radius).toBe(1);
  });

  it('不应该修改原始对象', () => {
    const customizations = createInitialCustomizations();
    const result = upgradeWeapon(customizations, 'wreckingBall', 'damage');

    expect(customizations.wreckingBall.upgrades.damage).toBe(1);
    expect(result).not.toBe(customizations);
  });

  it('不应该影响其他武器的升级', () => {
    const customizations = createInitialCustomizations();
    const result = upgradeWeapon(customizations, 'wreckingBall', 'damage');

    expect(result.steelBall.upgrades.damage).toBe(1);
    expect(result.explosive.upgrades.damage).toBe(1);
    expect(result.sprayPaint.upgrades.damage).toBe(1);
  });

  it('不应该超过最大等级', () => {
    const customizations = createInitialCustomizations();
    let result = customizations;

    for (let i = 0; i < UPGRADE_MAX_LEVEL + 5; i++) {
      result = upgradeWeapon(result, 'wreckingBall', 'damage');
    }

    expect(result.wreckingBall.upgrades.damage).toBe(UPGRADE_MAX_LEVEL);
  });

  it('在最大等级时应该返回相同的对象引用', () => {
    const customizations = createInitialCustomizations();
    let result = customizations;

    for (let i = 0; i < UPGRADE_MAX_LEVEL; i++) {
      result = upgradeWeapon(result, 'wreckingBall', 'damage');
    }

    const maxLevelResult = upgradeWeapon(result, 'wreckingBall', 'damage');
    expect(maxLevelResult).toBe(result);
  });

  it('应该可以升级所有武器和所有属性', () => {
    const weapons: WeaponType[] = ['wreckingBall', 'steelBall', 'explosive', 'sprayPaint'];
    const keys: WeaponUpgradeKey[] = ['damage', 'speed', 'radius'];

    weapons.forEach((weapon) => {
      keys.forEach((key) => {
        const customizations = createInitialCustomizations();
        const result = upgradeWeapon(customizations, weapon, key);
        expect(result[weapon].upgrades[key]).toBe(2);
      });
    });
  });

  it('应该保持外观配置不变', () => {
    const customizations = createInitialCustomizations();
    const originalAppearance = { ...customizations.wreckingBall.appearance };
    const result = upgradeWeapon(customizations, 'wreckingBall', 'damage');

    expect(result.wreckingBall.appearance).toEqual(originalAppearance);
  });
});

describe('weapon system - setWeaponAppearance', () => {
  const createInitialCustomizations = (): WeaponCustomizations =>
    JSON.parse(JSON.stringify(WEAPON_DEFAULTS));

  it('应该设置指定武器的指定外观属性', () => {
    const customizations = createInitialCustomizations();
    const result = setWeaponAppearance(customizations, 'wreckingBall', 'mainColor', '#ff0000');

    expect(result.wreckingBall.appearance.mainColor).toBe('#ff0000');
  });

  it('不应该修改原始对象', () => {
    const customizations = createInitialCustomizations();
    const result = setWeaponAppearance(customizations, 'wreckingBall', 'mainColor', '#ff0000');

    expect(customizations.wreckingBall.appearance.mainColor).not.toBe('#ff0000');
    expect(result).not.toBe(customizations);
  });

  it('不应该影响其他武器的外观', () => {
    const customizations = createInitialCustomizations();
    const result = setWeaponAppearance(customizations, 'wreckingBall', 'mainColor', '#ff0000');

    expect(result.steelBall.appearance.mainColor).toBe(WEAPON_DEFAULTS.steelBall.appearance.mainColor);
    expect(result.explosive.appearance.mainColor).toBe(WEAPON_DEFAULTS.explosive.appearance.mainColor);
  });

  it('应该可以设置所有外观属性', () => {
    const keys: WeaponAppearanceKey[] = ['mainColor', 'trailColor', 'glowColor', 'effectType'];

    keys.forEach((key) => {
      const customizations = createInitialCustomizations();
      const result = setWeaponAppearance(customizations, 'wreckingBall', key, 'test-value');
      expect(result.wreckingBall.appearance[key]).toBe('test-value');
    });
  });

  it('应该保持升级配置不变', () => {
    const customizations = createInitialCustomizations();
    const originalUpgrades = { ...customizations.wreckingBall.upgrades };
    const result = setWeaponAppearance(customizations, 'wreckingBall', 'mainColor', '#ff0000');

    expect(result.wreckingBall.upgrades).toEqual(originalUpgrades);
  });
});

describe('weapon system - getWeaponUpgrade', () => {
  it('应该返回指定武器的指定升级等级', () => {
    const customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    expect(getWeaponUpgrade(customizations, 'wreckingBall', 'damage')).toBe(1);
  });

  it('应该返回升级后的等级', () => {
    let customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    customizations = upgradeWeapon(customizations, 'steelBall', 'speed');
    customizations = upgradeWeapon(customizations, 'steelBall', 'speed');
    expect(getWeaponUpgrade(customizations, 'steelBall', 'speed')).toBe(3);
  });
});

describe('weapon system - getWeaponUpgradeMultiplier', () => {
  it('等级 1 时应该返回倍率 1', () => {
    const customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    expect(getWeaponUpgradeMultiplier(customizations, 'wreckingBall', 'damage')).toBe(1);
  });

  it('应该返回正确的倍率', () => {
    let customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    customizations = upgradeWeapon(customizations, 'explosive', 'radius');
    customizations = upgradeWeapon(customizations, 'explosive', 'radius');

    const expectedMultiplier = UPGRADE_MULTIPLIERS.radius(3);
    expect(getWeaponUpgradeMultiplier(customizations, 'explosive', 'radius')).toBe(expectedMultiplier);
  });
});

describe('weapon system - getWeaponAppearance', () => {
  it('应该返回指定武器的外观配置', () => {
    const customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    const appearance = getWeaponAppearance(customizations, 'wreckingBall');

    expect(appearance).toEqual(WEAPON_DEFAULTS.wreckingBall.appearance);
  });

  it('应该返回修改后的外观配置', () => {
    let customizations = JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
    customizations = setWeaponAppearance(customizations, 'sprayPaint', 'mainColor', '#00ff00');

    const appearance = getWeaponAppearance(customizations, 'sprayPaint');
    expect(appearance.mainColor).toBe('#00ff00');
  });
});

describe('weapon system - resetWeaponCustomizations', () => {
  it('应该返回默认的武器配置', () => {
    const result = resetWeaponCustomizations();
    expect(result).toEqual(WEAPON_DEFAULTS);
  });

  it('每次调用应该返回新的对象', () => {
    const result1 = resetWeaponCustomizations();
    const result2 = resetWeaponCustomizations();
    expect(result1).not.toBe(result2);
  });

  it('修改返回值不应该影响默认配置', () => {
    const result = resetWeaponCustomizations();
    result.wreckingBall.upgrades.damage = 10;

    const freshResult = resetWeaponCustomizations();
    expect(freshResult.wreckingBall.upgrades.damage).toBe(1);
  });
});
