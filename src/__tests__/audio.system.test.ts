import { describe, it, expect } from 'vitest';
import { updateAudioEffectsConfig } from '@/ecs/systems/audio';
import type { AudioEffectsConfig } from '@/store/gameStore';

describe('audio system - updateAudioEffectsConfig', () => {
  const defaultConfig: AudioEffectsConfig = {
    shakeIntensity: 0.6,
    glowIntensity: 0.8,
    collapseThreshold: 0.75,
    enableCollapse: true,
    colorMode: 'frequency',
  };

  it('应该用新值更新配置', () => {
    const result = updateAudioEffectsConfig(defaultConfig, { shakeIntensity: 0.9 });

    expect(result.shakeIntensity).toBe(0.9);
  });

  it('不应该修改原始配置对象', () => {
    const result = updateAudioEffectsConfig(defaultConfig, { shakeIntensity: 0.9 });

    expect(defaultConfig.shakeIntensity).toBe(0.6);
    expect(result).not.toBe(defaultConfig);
  });

  it('未指定的字段应该保持不变', () => {
    const result = updateAudioEffectsConfig(defaultConfig, { glowIntensity: 1.0 });

    expect(result.shakeIntensity).toBe(defaultConfig.shakeIntensity);
    expect(result.collapseThreshold).toBe(defaultConfig.collapseThreshold);
    expect(result.enableCollapse).toBe(defaultConfig.enableCollapse);
    expect(result.colorMode).toBe(defaultConfig.colorMode);
  });

  it('应该可以一次更新多个字段', () => {
    const result = updateAudioEffectsConfig(defaultConfig, {
      shakeIntensity: 0.3,
      glowIntensity: 0.5,
      enableCollapse: false,
    });

    expect(result.shakeIntensity).toBe(0.3);
    expect(result.glowIntensity).toBe(0.5);
    expect(result.enableCollapse).toBe(false);
  });

  it('空对象应该返回相同的配置', () => {
    const result = updateAudioEffectsConfig(defaultConfig, {});

    expect(result).toEqual(defaultConfig);
  });

  it('应该可以更新 colorMode', () => {
    const result = updateAudioEffectsConfig(defaultConfig, { colorMode: 'rainbow' });

    expect(result.colorMode).toBe('rainbow');
  });
});
