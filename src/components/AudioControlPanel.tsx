import { useRef, useState, useEffect, useMemo } from 'react';
import {
  Music,
  Mic,
  Upload,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
  Bomb,
  Palette,
  Settings2,
  ChevronDown,
  ChevronUp,
  Radio,
  FileMusic,
} from 'lucide-react';
import { useAudioAnalyzer, AudioSourceType } from '@/hooks/useAudioAnalyzer';
import { useGameStore, AudioEffectsConfig } from '@/store/gameStore';

const colorModeConfigs: {
  type: AudioEffectsConfig['colorMode'];
  name: string;
  description: string;
}[] = [
  { type: 'frequency', name: '分频映射', description: '低频红、中频橙、高频蓝' },
  { type: 'rainbow', name: '彩虹流动', description: '随音乐流动的七彩光效' },
  { type: 'pulse', name: '材质脉动', description: '保持材质本色随音乐脉动' },
  { type: 'material', name: '原色发光', description: '仅发光不改变颜色' },
];

export function AudioControlPanel() {
  const {
    sourceType,
    isPlaying,
    analysis,
    volume: outputVolume,
    startMicrophone,
    loadAudioFile,
    togglePlay,
    stop,
    setOutputVolume,
  } = useAudioAnalyzer();

  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const setAudioEnabled = useGameStore((s) => s.setAudioEnabled);
  const setAudioAnalysis = useGameStore((s) => s.setAudioAnalysis);
  const audioEffectsConfig = useGameStore((s) => s.audioEffectsConfig);
  const updateAudioEffectsConfig = useGameStore((s) => s.updateAudioEffectsConfig);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micLoading, setMicLoading] = useState(false);

  useEffect(() => {
    if (audioEnabled && (sourceType === 'microphone' || sourceType === 'file')) {
      setAudioAnalysis({
        bass: analysis.bass,
        mid: analysis.mid,
        treble: analysis.treble,
        volume: analysis.volume,
        spectrum: analysis.spectrum,
        beatDetected: analysis.beatDetected,
      });
    }
  }, [analysis, audioEnabled, sourceType, setAudioAnalysis]);

  const handleStartMicrophone = async () => {
    setError(null);
    setMicLoading(true);
    try {
      await startMicrophone();
      setAudioEnabled(true);
    } catch (e) {
      setError('无法访问麦克风，请检查权限设置');
      console.error(e);
    } finally {
      setMicLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      await loadAudioFile(file);
      setAudioEnabled(true);
    } catch (err) {
      setError('无法加载音频文件，请选择有效的音频格式');
      console.error(err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStop = () => {
    stop();
    setAudioEnabled(false);
    setError(null);
  };

  const spectrumBars = useMemo(() => {
    const bars = 48;
    const spectrum = analysis.spectrum;
    if (!spectrum || spectrum.length === 0) return new Array(bars).fill(0);

    const logScale = true;
    const result: number[] = [];
    const len = spectrum.length;

    for (let i = 0; i < bars; i++) {
      let startIdx: number;
      let endIdx: number;

      if (logScale) {
        const freqMin = Math.log(1);
        const freqMax = Math.log(len);
        const logStart = freqMin + (freqMax - freqMin) * (i / bars);
        const logEnd = freqMin + (freqMax - freqMin) * ((i + 1) / bars);
        startIdx = Math.floor(Math.exp(logStart));
        endIdx = Math.floor(Math.exp(logEnd));
      } else {
        startIdx = Math.floor((i / bars) * len);
        endIdx = Math.floor(((i + 1) / bars) * len);
      }

      startIdx = Math.max(0, Math.min(len - 1, startIdx));
      endIdx = Math.max(startIdx + 1, Math.min(len, endIdx));

      let sum = 0;
      for (let j = startIdx; j < endIdx; j++) {
        sum += spectrum[j];
      }
      const avg = sum / (endIdx - startIdx);
      result.push(Math.min(1, avg * 1.8));
    }

    return result;
  }, [analysis.spectrum]);

  const sourceLabel: Record<AudioSourceType, string> = {
    microphone: '麦克风输入',
    file: '本地文件',
    none: '未连接',
  };

  const SourceIcon = sourceType === 'microphone' ? Mic : sourceType === 'file' ? FileMusic : Radio;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-50 w-[min(720px,95vw)]">
      <div className="bg-black/70 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-white/5 cursor-pointer select-none hover:bg-white/5 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                audioEnabled && isPlaying
                  ? 'bg-gradient-to-br from-pink-500 to-violet-600 shadow-lg shadow-pink-500/30'
                  : 'bg-white/10'
              }`}
            >
              <Music className={`w-5 h-5 ${audioEnabled && isPlaying ? 'text-white animate-pulse' : 'text-white/60'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">音频可视化</span>
                {audioEnabled && isPlaying && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-300 font-medium">实时</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <SourceIcon className="w-3 h-3 text-white/40" />
                <span className="text-[11px] text-white/50">{sourceLabel[sourceType]}</span>
                {sourceType !== 'none' && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-[11px] text-white/50">
                      音量 {Math.round(outputVolume * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5 h-5 mr-2">
              {spectrumBars.slice(0, 16).map((v, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full bg-gradient-to-t from-pink-500 to-violet-400 transition-all duration-75"
                  style={{ height: `${Math.max(8, v * 100)}%` }}
                />
              ))}
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronUp className="w-4 h-4 text-white/50" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">低频 Bass</div>
                <div className="mt-1">
                  <div className="inline-flex items-baseline gap-1">
                    <span className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                      {Math.round(analysis.bass * 100)}
                    </span>
                    <span className="text-[10px] text-white/40">%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-75"
                    style={{ width: `${analysis.bass * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">中频 Mid</div>
                <div className="mt-1">
                  <div className="inline-flex items-baseline gap-1">
                    <span className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                      {Math.round(analysis.mid * 100)}
                    </span>
                    <span className="text-[10px] text-white/40">%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-75"
                    style={{ width: `${analysis.mid * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">高频 Treble</div>
                <div className="mt-1">
                  <div className="inline-flex items-baseline gap-1">
                    <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      {Math.round(analysis.treble * 100)}
                    </span>
                    <span className="text-[10px] text-white/40">%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-75"
                    style={{ width: `${analysis.treble * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="h-16 rounded-xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 overflow-hidden relative p-2">
              <div className="absolute inset-0 flex items-end justify-around px-2 gap-0.5 pb-2 pt-3">
                {spectrumBars.map((v, i) => {
                  const ratio = i / spectrumBars.length;
                  const hue = ratio * 0.75;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm transition-all duration-75"
                      style={{
                        height: `${Math.max(4, v * 100)}%`,
                        background: `linear-gradient(to top, hsl(${hue * 360}, 80%, 50%), hsl(${(hue + 0.15) * 360}, 80%, 65%))`,
                        opacity: 0.6 + v * 0.4,
                        minWidth: '3px',
                      }}
                    />
                  );
                })}
              </div>
              {analysis.beatDetected && (
                <div className="absolute top-1.5 right-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-ping" />
                  <span className="text-[10px] text-yellow-300 font-bold animate-pulse">BEAT</span>
                </div>
              )}
              <div className="absolute top-1.5 left-2 text-[10px] text-white/40 font-mono">
                FFT SPECTRUM
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleStartMicrophone}
                disabled={micLoading}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all border ${
                  sourceType === 'microphone' && isPlaying
                    ? 'bg-gradient-to-br from-pink-500/30 to-violet-600/30 border-pink-500/40 shadow-lg shadow-pink-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                } ${micLoading ? 'opacity-60 cursor-wait' : ''}`}
              >
                <Mic className={`w-4 h-4 ${sourceType === 'microphone' ? 'text-pink-400' : 'text-white/70'}`} />
                <span className={`text-sm font-medium ${sourceType === 'microphone' ? 'text-white' : 'text-white/80'}`}>
                  {micLoading ? '授权中...' : sourceType === 'microphone' && isPlaying ? '麦克风已启用' : '使用麦克风'}
                </span>
              </button>

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-all border ${
                    sourceType === 'file'
                      ? 'bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <Upload className={`w-4 h-4 ${sourceType === 'file' ? 'text-emerald-400' : 'text-white/70'}`} />
                  <span className={`text-sm font-medium ${sourceType === 'file' ? 'text-white' : 'text-white/80'}`}>
                    {sourceType === 'file' ? '更换文件' : '上传音频文件'}
                  </span>
                </button>
              </div>
            </div>

            {sourceType === 'file' && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <button
                  onClick={togglePlay}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-red-500/20 hover:border-red-500/30 border border-white/10 transition-all"
                >
                  <Square className="w-3.5 h-3.5 text-white/70" />
                </button>

                <div className="flex-1 flex items-center gap-2 ml-2">
                  {outputVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-white/40 flex-shrink-0" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white/60 flex-shrink-0" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={outputVolume}
                    onChange={(e) => setOutputVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            )}

            {sourceType === 'microphone' && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <button
                  onClick={handleStop}
                  className="flex items-center justify-center gap-2 px-3 h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all text-sm"
                >
                  <Square className="w-3.5 h-3.5 text-red-300" />
                  <span className="text-red-300 font-medium">停止麦克风</span>
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4 text-white/50" />
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">效果参数</span>
                <div className="flex-1 h-px bg-white/10" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={audioEnabled && sourceType !== 'none'}
                      onChange={(e) => {
                        if (sourceType === 'none') return;
                        setAudioEnabled(e.target.checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 rounded-full bg-white/10 peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-violet-600 transition-all" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white peer-checked:translate-x-4 transition-transform shadow-lg" />
                  </div>
                  <span className="text-xs text-white/60">启用效果</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-[11px] text-white/70">震动强度</span>
                    </div>
                    <span className="text-[11px] text-white/50 font-mono">
                      {Math.round(audioEffectsConfig.shakeIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={audioEffectsConfig.shakeIntensity}
                    onChange={(e) =>
                      updateAudioEffectsConfig({ shakeIntensity: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="text-[11px] text-white/70">发光强度</span>
                    </div>
                    <span className="text-[11px] text-white/50 font-mono">
                      {Math.round(audioEffectsConfig.glowIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={audioEffectsConfig.glowIntensity}
                    onChange={(e) =>
                      updateAudioEffectsConfig({ glowIntensity: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bomb className="w-3 h-3 text-red-400" />
                      <span className="text-[11px] text-white/70">崩解阈值</span>
                    </div>
                    <span className="text-[11px] text-white/50 font-mono">
                      {Math.round((1 - audioEffectsConfig.collapseThreshold) * 100) + '%'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.01}
                    value={audioEffectsConfig.collapseThreshold}
                    onChange={(e) =>
                      updateAudioEffectsConfig({ collapseThreshold: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3 h-3 text-purple-400" />
                      <span className="text-[11px] text-white/70">颜色模式</span>
                    </div>
                  </div>
                  <select
                    value={audioEffectsConfig.colorMode}
                    onChange={(e) =>
                      updateAudioEffectsConfig({
                        colorMode: e.target.value as AudioEffectsConfig['colorMode'],
                      })
                    }
                    className="w-full h-7 px-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
                  >
                    {colorModeConfigs.map((c) => (
                      <option key={c.type} value={c.type} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Bomb className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-white/80 font-medium">音乐驱动崩解</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    {colorModeConfigs.find((c) => c.type === audioEffectsConfig.colorMode)?.description}
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={audioEffectsConfig.enableCollapse}
                      onChange={(e) =>
                        updateAudioEffectsConfig({ enableCollapse: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 rounded-full bg-white/10 peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-orange-600 transition-all" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white peer-checked:translate-x-4 transition-transform shadow-lg" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioControlPanel;
