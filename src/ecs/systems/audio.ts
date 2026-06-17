import type { AudioAnalysisData, AudioEffectsConfig } from '../../store/gameStore';

export function updateAudioEffectsConfig(
  current: AudioEffectsConfig,
  partial: Partial<AudioEffectsConfig>
): AudioEffectsConfig {
  return { ...current, ...partial };
}
