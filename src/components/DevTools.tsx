import { useState, useEffect, useMemo } from 'react';
import {
  Bug,
  Activity,
  Database,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Info,
  XCircle,
  RotateCcw,
  Zap,
  Box,
  Sparkles,
  Bomb,
  Settings2,
  Layers,
  Gauge,
  Eye,
  EyeOff,
} from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useGameStore, type MaterialType, type GameMode } from '@/store/gameStore';
import { errorLogger, type ErrorLogEntry } from '@/lib/errorLogger';

type PanelType = 'performance' | 'state' | 'errors' | 'actions' | 'settings';

interface DebugSettings {
  showBlockOutlines: boolean;
  showParticleTrails: boolean;
  disableShadows: boolean;
  slowMotion: boolean;
  slowMotionFactor: number;
  godMode: boolean;
  wireframeMode: boolean;
  infiniteAmmo: boolean;
}

const DEFAULT_SETTINGS: DebugSettings = {
  showBlockOutlines: false,
  showParticleTrails: false,
  disableShadows: false,
  slowMotion: false,
  slowMotionFactor: 0.25,
  godMode: false,
  wireframeMode: false,
  infiniteAmmo: false,
};

export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>('performance');
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [settings, setSettings] = useState<DebugSettings>(DEFAULT_SETTINGS);

  const metrics = usePerformanceMetrics();
  const state = useGameStore();

  useEffect(() => {
    const unsub = errorLogger.subscribe(setErrorLogs);
    return unsub;
  }, []);

  useEffect(() => {
    (window as unknown as { __DEBUG__?: DebugSettings & { toggle: () => void } }).__DEBUG__ = {
      ...settings,
      toggle: () => setIsOpen((v) => !v),
    };
  }, [settings]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && e.altKey) {
        e.preventDefault();
        setActivePanel('errors');
        errorLogger.clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const errorCount = useMemo(
    () => errorLogs.filter((e) => e.level === 'error').length,
    [errorLogs]
  );
  const warningCount = useMemo(
    () => errorLogs.filter((e) => e.level === 'warning').length,
    [errorLogs]
  );

  const updateSetting = <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const panels: { id: PanelType; label: string; icon: typeof Bug; badge?: number }[] = [
    { id: 'performance', label: '性能', icon: Activity, badge: undefined },
    { id: 'state', label: '状态', icon: Database, badge: undefined },
    { id: 'errors', label: '日志', icon: AlertCircle, badge: errorCount || warningCount || undefined },
    { id: 'actions', label: '操作', icon: Zap, badge: undefined },
    { id: 'settings', label: '设置', icon: Settings2, badge: undefined },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-3 right-3 z-[9998] flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm transition-all shadow-lg ${
          isOpen
            ? 'opacity-0 pointer-events-none'
            : errorCount > 0
              ? 'bg-red-600/90 hover:bg-red-600 text-white animate-pulse shadow-red-500/30'
              : warningCount > 0
                ? 'bg-amber-500/90 hover:bg-amber-500 text-white shadow-amber-500/30'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 shadow-slate-900/40 border border-slate-600/30'
        }`}
      >
        <Bug className="w-4 h-4" />
        调试
        {errorCount > 0 && <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{errorCount}</span>}
      </button>

      <div
        className={`fixed top-0 right-0 h-screen z-[9999] transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 shadow-2xl">
          <div className="w-16 flex flex-col items-center py-4 gap-1 bg-slate-900/60 border-r border-slate-700/30">
            {panels.map((panel) => (
              <button
                key={panel.id}
                onClick={() => setActivePanel(panel.id)}
                className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  activePanel === panel.id
                    ? 'bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <panel.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{panel.label}</span>
                {panel.badge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900">
                    {panel.badge > 99 ? '99+' : panel.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="flex-1" />

            <button
              onClick={() => setIsOpen(false)}
              className="w-12 h-12 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 flex items-center justify-center transition-all"
              title="关闭 (Ctrl+\\"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="w-[380px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-200">
                  {panels.find((p) => p.id === activePanel)?.label}面板
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-700/50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activePanel === 'performance' && (
                <PerformancePanel metrics={metrics} />
              )}
              {activePanel === 'state' && (
                <StatePanel state={state} />
              )}
              {activePanel === 'errors' && (
                <ErrorsPanel logs={errorLogs} onClear={() => errorLogger.clear()} />
              )}
              {activePanel === 'actions' && (
                <ActionsPanel settings={settings} updateSetting={updateSetting} />
              )}
              {activePanel === 'settings' && (
                <SettingsPanel settings={settings} updateSetting={updateSetting} />
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-700/40 bg-slate-900/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>快捷键: Ctrl+\ 切换面板</span>
                <span>v0.1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PerformancePanel({ metrics }: { metrics: ReturnType<typeof usePerformanceMetrics> }) {
  const fpsColor = metrics.fps >= 50 ? 'text-emerald-400' : metrics.fps >= 30 ? 'text-amber-400' : 'text-red-400';
  const memColor = metrics.memoryPercent < 60 ? 'text-emerald-400' : metrics.memoryPercent < 85 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Gauge}
          label="FPS"
          value={metrics.fps.toString()}
          sub={`${metrics.renderTimeMs} ms/帧`}
          valueClassName={fpsColor}
          sparkline={metrics.fpsHistory}
        />
        <StatCard
          icon={Layers}
          label="内存"
          value={metrics.memoryUsed > 0 ? `${metrics.memoryUsed}` : 'N/A'}
          sub={metrics.memoryUsed > 0 ? `共 ${metrics.memoryTotal} MB` : 'Chrome 可用'}
          valueClassName={memColor}
          progress={metrics.memoryPercent}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Box}
          label="方块数"
          value={metrics.blockCount.toString()}
          sub={`${metrics.physicsBodyCount} 物理体`}
          valueClassName="text-sky-400"
        />
        <StatCard
          icon={Sparkles}
          label="粒子"
          value={metrics.particleCount.toString()}
          sub={`${metrics.explosionCount} 爆炸`}
          valueClassName="text-violet-400"
        />
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">FPS 趋势</p>
          <span className={`text-xs font-mono ${fpsColor}`}>{metrics.fps} fps</span>
        </div>
        <div className="h-20 flex items-end gap-[2px]">
          {metrics.fpsHistory.map((fps, i) => {
            const height = Math.max(5, (fps / 60) * 100);
            const color = fps >= 50 ? 'bg-emerald-500' : fps >= 30 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <div
                key={i}
                className={`flex-1 ${color} rounded-sm transition-all`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-500 font-mono">
          <span>-30s</span>
          <span>0</span>
        </div>
      </div>
    </div>
  );
}

function StatePanel({ state }: { state: ReturnType<typeof useGameStore> }) {
  const materialCounts: Record<MaterialType, number> = { wood: 0, glass: 0, concrete: 0 };
  state.blocks.forEach((b) => {
    materialCounts[b.material]++;
  });

  const modeLabels: Record<GameMode, string> = {
    destroy: '破坏模式',
    build: '建造模式',
    roboticArm: '机械臂模式',
    physicsLab: '物理实验室',
  };

  return (
    <div className="space-y-4">
      <KeyValueList
        title="核心状态"
        items={[
          { label: '游戏模式', value: modeLabels[state.gameMode], accent: true },
          { label: '当前武器', value: state.weapon, accent: true },
          { label: '重力方向', value: state.gravityDirection },
          { label: '破坏球激活', value: state.wreckingBallActive ? '是' : '否' },
          { label: '射击冷却', value: state.shootCooldown ? '是' : '否' },
        ]}
      />

      <KeyValueList
        title="实体统计"
        items={[
          { label: '木块', value: materialCounts.wood, color: 'text-amber-400' },
          { label: '玻璃', value: materialCounts.glass, color: 'text-sky-400' },
          { label: '混凝土', value: materialCounts.concrete, color: 'text-slate-400' },
          { label: '蓝图', value: state.blueprints.length },
          { label: '撤销栈', value: `${state.undoStack.length} / 50` },
        ]}
      />

      <KeyValueList
        title="建造模式"
        items={[
          { label: '建造工具', value: state.buildTool },
          { label: '建造材质', value: state.buildMaterial },
          { label: '选中方块', value: state.selectedBlockId ?? '无' },
        ]}
      />

      <KeyValueList
        title="音频"
        items={[
          { label: '音频启用', value: state.audioEnabled ? '是' : '否' },
          { label: '音量', value: `${Math.round(state.audioAnalysis.volume * 100)}%` },
          { label: '低音', value: `${Math.round(state.audioAnalysis.bass * 100)}%` },
          { label: '节拍检测', value: state.audioAnalysis.beatDetected ? '是' : '否' },
        ]}
      />
    </div>
  );
}

function ErrorsPanel({ logs, onClear }: { logs: ErrorLogEntry[]; onClear: () => void }) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const filtered = logs.filter((l) => filter === 'all' || l.level === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['all', 'error', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
            }`}
          >
            {f === 'all' ? '全部' : f === 'error' ? '错误' : f === 'warning' ? '警告' : '信息'}
          </button>
        ))}
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 border border-slate-700/40 transition-all"
          title="清除日志"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无日志</p>
          </div>
        ) : (
          filtered.map((log) => (
            <LogItem key={log.id} entry={log} />
          ))
        )}
      </div>
    </div>
  );
}

function LogItem({ entry }: { entry: ErrorLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const levelConfig = {
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle, iconColor: 'text-red-400', label: '错误' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, iconColor: 'text-amber-400', label: '警告' },
    info: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', icon: Info, iconColor: 'text-sky-400', label: '信息' },
  }[entry.level];

  return (
    <div className={`${levelConfig.bg} border ${levelConfig.border} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <levelConfig.icon className={`w-4 h-4 ${levelConfig.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelConfig.iconColor} bg-current/10`}>
              {levelConfig.label}
            </span>
            <span className="text-xs text-slate-400 font-mono">{entry.type}</span>
            <span className="text-[10px] text-slate-500 ml-auto font-mono">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs text-slate-300 line-clamp-2">{entry.message}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/5">
          {entry.stack && (
            <div className="bg-slate-900/60 rounded-lg p-2 max-h-32 overflow-auto">
              <p className="text-[10px] text-slate-500 mb-1">Stack Trace</p>
              <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-words">
                {entry.stack}
              </pre>
            </div>
          )}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="bg-slate-900/60 rounded-lg p-2">
              <p className="text-[10px] text-slate-500 mb-1">Metadata</p>
              <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionsPanel({
  settings,
  updateSetting,
}: {
  settings: DebugSettings;
  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => void;
}) {
  const store = useGameStore();

  const actions = [
    {
      icon: RotateCcw,
      label: '重置游戏',
      desc: '清除所有方块和粒子',
      onClick: () => store.resetGame(),
      color: 'from-rose-600 to-red-600',
    },
    {
      icon: Bomb,
      label: '中央大爆炸',
      desc: '在原点附近触发爆炸',
      onClick: () => {
        store.setShootCooldown(false);
        const state = useGameStore.getState();
        if (state.world) {
          const impl = (window as unknown as { __APPLY_EXPLOSION__?: (p: [number, number, number], r: number) => void }).__APPLY_EXPLOSION__;
          if (impl) impl([0, 3, 0], 15);
        }
      },
      color: 'from-orange-600 to-amber-600',
    },
    {
      icon: Zap,
      label: '强制重置冷却',
      desc: '立即解除射击冷却',
      onClick: () => store.setShootCooldown(false),
      color: 'from-emerald-600 to-teal-600',
    },
    {
      icon: Sparkles,
      label: '清除粒子',
      desc: '移除所有特效和粒子',
      onClick: () => {
        const ids = Array.from(store.particles.keys());
        ids.forEach((id) => store.removeParticle(id));
      },
      color: 'from-violet-600 to-indigo-600',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">快捷操作</p>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${action.color} hover:brightness-110 active:scale-[0.98] transition-all shadow-lg`}
          >
            <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-semibold text-sm">{action.label}</p>
              <p className="text-white/70 text-xs">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">调试开关</p>
        <div className="space-y-2">
          <ToggleRow
            icon={settings.showBlockOutlines ? Eye : EyeOff}
            label="方块轮廓"
            desc="显示方块外边框"
            checked={settings.showBlockOutlines}
            onChange={(v) => updateSetting('showBlockOutlines', v)}
          />
          <ToggleRow
            icon={settings.wireframeMode ? Eye : EyeOff}
            label="线框模式"
            desc="所有物体使用线框渲染"
            checked={settings.wireframeMode}
            onChange={(v) => updateSetting('wireframeMode', v)}
          />
          <ToggleRow
            icon={settings.slowMotion ? Zap : Zap}
            label="慢动作"
            desc="降低物理和渲染速度"
            checked={settings.slowMotion}
            onChange={(v) => updateSetting('slowMotion', v)}
          />
          <ToggleRow
            icon={settings.godMode ? Sparkles : Sparkles}
            label="无敌模式"
            desc="方块不会被破坏"
            checked={settings.godMode}
            onChange={(v) => updateSetting('godMode', v)}
          />
          <ToggleRow
            icon={settings.infiniteAmmo ? Box : Box}
            label="无限弹药"
            desc="无射击冷却"
            checked={settings.infiniteAmmo}
            onChange={(v) => updateSetting('infiniteAmmo', v)}
          />
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  updateSetting,
}: {
  settings: DebugSettings;
  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-200">慢动作倍率</p>
            <span className="text-xs font-mono text-indigo-400">
              {(1 / settings.slowMotionFactor).toFixed(1)}× 更慢
            </span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={settings.slowMotionFactor}
            onChange={(e) => updateSetting('slowMotionFactor', parseFloat(e.target.value))}
            disabled={!settings.slowMotion}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
          />
          <div className="flex justify-between mt-1 text-[10px] text-slate-500 font-mono">
            <span>20×</span>
            <span>1×</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-slate-200 mb-1">全局调试切换</p>
        <ToggleRow
          icon={settings.disableShadows ? EyeOff : Eye}
          label="禁用阴影"
          desc="提高性能但降低视觉"
          checked={settings.disableShadows}
          onChange={(v) => updateSetting('disableShadows', v)}
        />
        <ToggleRow
          icon={settings.showParticleTrails ? Eye : EyeOff}
          label="粒子轨迹"
          desc="显示粒子运动轨迹"
          checked={settings.showParticleTrails}
          onChange={(v) => updateSetting('showParticleTrails', v)}
        />
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">控制台访问</p>
        <p className="text-xs text-slate-300 mb-2 font-mono">window.__DEBUG__</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          可在浏览器控制台访问调试设置对象，使用 <code className="text-slate-300 bg-slate-700/50 px-1 rounded">window.__SCENE__</code> 和 <code className="text-slate-300 bg-slate-700/50 px-1 rounded">window.__CAMERA__</code> 访问 Three.js 场景和相机。
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClassName = 'text-slate-200',
  sparkline,
  progress,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  sparkline?: number[];
  progress?: number;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
        {sparkline && (
          <div className="absolute top-2 right-2 h-6 flex items-end gap-[1px] opacity-50">
            {sparkline.slice(-20).map((v, i) => {
              const maxV = Math.max(...sparkline.slice(-20), 1);
              const color = (v / Math.max(60, 1)) >= 0.8 ? 'bg-emerald-500' : (v / Math.max(60, 1)) >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div
                  key={i}
                  className={`w-[2px] ${color} rounded-sm`}
                  style={{ height: `${(v / maxV) * 100}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold font-mono ${valueClassName}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      {progress !== undefined && progress > 0 && (
        <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${progress < 60 ? 'bg-emerald-500' : progress < 85 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function KeyValueList({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number; color?: string; accent?: boolean }[];
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/40 bg-slate-800/40">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y divide-slate-700/30">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-slate-400 text-xs">{item.label}</span>
            <span
              className={`font-mono text-xs ${
                item.color ??
                (item.accent ? 'text-indigo-300' : 'text-slate-200')
              }`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: typeof Eye;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        checked
          ? 'bg-indigo-600/15 border border-indigo-500/30'
          : 'bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800/60'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          checked ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/50 text-slate-400'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-medium ${checked ? 'text-slate-100' : 'text-slate-300'}`}>
          {label}
        </p>
        {desc && <p className="text-[11px] text-slate-500">{desc}</p>}
      </div>
      <div
        className={`w-11 h-6 rounded-full p-0.5 transition-all flex-shrink-0 ${
          checked ? 'bg-indigo-500' : 'bg-slate-600'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}

export default DevTools;
