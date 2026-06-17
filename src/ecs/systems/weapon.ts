import type { World } from '../core';
import type {
  WeaponType,
  WeaponUpgradeKey,
  WeaponAppearanceKey,
  WeaponCustomizations,
  WeaponAppearance,
  WeaponUpgradeLevels,
} from '../../store/gameStore';
import { WEAPON_DEFAULTS, UPGRADE_MAX_LEVEL, UPGRADE_MULTIPLIERS } from '../../store/gameStore';

export function upgradeWeapon(
  customizations: WeaponCustomizations,
  weapon: WeaponType,
  key: WeaponUpgradeKey
): WeaponCustomizations {
  const current = customizations[weapon].upgrades[key];
  if (current >= UPGRADE_MAX_LEVEL) return customizations;
  const next = { ...customizations };
  next[weapon] = {
    ...next[weapon],
    upgrades: { ...next[weapon].upgrades, [key]: current + 1 },
  };
  return next;
}

export function setWeaponAppearance(
  customizations: WeaponCustomizations,
  weapon: WeaponType,
  key: WeaponAppearanceKey,
  value: string
): WeaponCustomizations {
  const next = { ...customizations };
  next[weapon] = {
    ...next[weapon],
    appearance: { ...next[weapon].appearance, [key]: value },
  };
  return next;
}

export function getWeaponUpgrade(
  customizations: WeaponCustomizations,
  weapon: WeaponType,
  key: WeaponUpgradeKey
): number {
  return customizations[weapon].upgrades[key];
}

export function getWeaponUpgradeMultiplier(
  customizations: WeaponCustomizations,
  weapon: WeaponType,
  key: WeaponUpgradeKey
): number {
  const level = customizations[weapon].upgrades[key];
  return UPGRADE_MULTIPLIERS[key](level);
}

export function getWeaponAppearance(
  customizations: WeaponCustomizations,
  weapon: WeaponType
): WeaponAppearance {
  return customizations[weapon].appearance;
}

export function resetWeaponCustomizations(): WeaponCustomizations {
  return JSON.parse(JSON.stringify(WEAPON_DEFAULTS));
}
