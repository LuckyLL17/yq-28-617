import { useState } from 'react';
import { useGameStore, WeaponType, MaterialType, BuildTool, GravityDirection, GRAVITY_LABELS, ConstraintType, LabObjectType, LabTool, WeaponUpgradeKey, WeaponEffectType, UPGRADE_MAX_LEVEL, UPGRADE_LABELS, UPGRADE_MULTIPLIERS, EFFECT_TYPE_LABELS, EFFECT_COLORS, BlueprintData } from '@/store/gameStore';
import { Hammer, Circle, Bomb, RotateCcw, Building2, Castle, Eye, Undo2, Redo2, Trash2, Move, RotateCw, Plus, Box, Wrench, Swords, SprayCan, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, CircleDot, CircleX, Bot, Grip, RefreshCw, FlaskConical, Link, Anchor, Minus, Scaling, Unlink, ChevronUp, Palette, Sparkles, Zap, Target, Save, FolderOpen, X } from 'lucide-react';

interface ControlPanelProps {
  onReset: () => void;
  onRegenerateBuilding: (type: 'building' | 'castle') => void;
  onClearBuild: () => void;
  onResetRoboticArm: () => void;
  onResetPhysicsLab: () => void;
  onLoadBlueprint: (blueprint: BlueprintData) => void;
}

const weaponConfigs: { type: WeaponType; name: string; description: string; icon: typeof Hammer; color: string }[] = [
  {
    type: 'wreckingBall',
    name: '重力落锤',
    description: '点击推动沉重的铁球，利用重力和惯性进行大面积破坏',
    icon: Hammer,
    color: 'from-gray-500 to-gray-700',
  },
  {
    type: 'steelBall',
    name: '弹射钢球',
    description: '瞄准射击，高速穿透的精准打击武器',
    icon: Circle,
    color: 'from-cyan-500 to-blue-600',
  },
  {
    type: 'explosive',
    name: '定向爆破',
    description: '投掷爆炸物，巨大冲击力粉碎一切',
    icon: Bomb,
    color: 'from-orange-500 to-red-600',
  },
  {
    type: 'sprayPaint',
    name: '涂鸦喷枪',
    description: '在方块表面喷涂图案和颜色，破坏时碎片保留涂鸦',
    icon: SprayCan,
    color: 'from-pink-500 to-rose-600',
  },
];

const materialConfigs: { type: MaterialType; name: string; icon: typeof Box; color: string; bgClass: string }[] = [
  { type: 'wood', name: '木材', icon: Box, color: '#8B4513', bgClass: 'from-amber-700 to-amber-900' },
  { type: 'glass', name: '玻璃', icon: Box, color: '#88ccff', bgClass: 'from-cyan-400 to-blue-500' },
  { type: 'concrete', name: '混凝土', icon: Box, color: '#808080', bgClass: 'from-gray-500 to-gray-700' },
];

const toolConfigs: { type: BuildTool; name: string; icon: typeof Plus; color: string }[] = [
  { type: 'place', name: '放置', icon: Plus, color: 'from-emerald-500 to-green-600' },
  { type: 'move', name: '移动', icon: Move, color: 'from-blue-500 to-indigo-600' },
  { type: 'rotate', name: '旋转', icon: RotateCw, color: 'from-purple-500 to-violet-600' },
  { type: 'delete', name: '删除', icon: Trash2, color: 'from-red-500 to-rose-600' },
  { type: 'sprayPaint', name: '涂鸦', icon: SprayCan, color: 'from-pink-500 to-rose-600' },
];

const gravityConfigs: { type: GravityDirection; name: string; icon: typeof ArrowDown; color: string }[] = [
  { type: 'down', name: '向下', icon: ArrowDown, color: 'from-gray-500 to-gray-700' },
  { type: 'up', name: '向上', icon: ArrowUp, color: 'from-indigo-500 to-purple-600' },
  { type: 'left', name: '向左', icon: ArrowLeft, color: 'from-cyan-500 to-blue-600' },
  { type: 'right', name: '向右', icon: ArrowRight, color: 'from-emerald-500 to-teal-600' },
  { type: 'forward', name: '向前', icon: CircleDot, color: 'from-orange-500 to-amber-600' },
  { type: 'backward', name: '向后', icon: CircleX, color: 'from-pink-500 to-rose-600' },
];

const SPRAY_COLORS = [
  '#ff0066', '#ff3366', '#ff6633', '#ff9900', '#ffcc00',
  '#66ff33', '#00ff66', '#00ffcc', '#00ccff', '#3366ff',
  '#6633ff', '#cc33ff', '#ff33cc', '#ffffff', '#000000',
];

const UPGRADE_ICONS: Record<WeaponUpgradeKey, typeof Zap> = {
  damage: Zap,
  speed: Target,
  radius: Circle,
};

const UPGRADE_COLORS: Record<WeaponUpgradeKey, string> = {
  damage: 'from-red-500 to-orange-500',
  speed: 'from-cyan-500 to-blue-500',
  radius: 'from-purple-500 to-pink-500',
};

const APPEARANCE_COLORS = [
  '#ff0000', '#ff4500', '#ff8c00', '#ffd700', '#ffff00',
  '#7cfc00', '#00ff00', '#00fa9a', '#00ffff', '#00bfff',
  '#0000ff', '#8a2be2', '#ff00ff', '#ff1493', '#ffffff',
  '#888888', '#444444', '#000000',
];

const EFFECT_ICONS: Record<WeaponEffectType, string> = {
  none: '⚪',
  fire: '🔥',
  electric: '⚡',
  rainbow: '🌈',
  shadow: '🌑',
};

const labObjectConfigs: { type: LabObjectType; name: string; icon: typeof Box; color: string; bgClass: string }[] = [
  { type: 'box', name: '立方体', icon: Box, color: '#4a90d9', bgClass: 'from-blue-500 to-blue-700' },
  { type: 'sphere', name: '球体', icon: Circle, color: '#e74c3c', bgClass: 'from-red-500 to-red-700' },
  { type: 'cylinder', name: '圆柱体', icon: Minus, color: '#2ecc71', bgClass: 'from-green-500 to-green-700' },
  { type: 'groundAnchor', name: '锚点', icon: Anchor, color: '#95a5a6', bgClass: 'from-gray-500 to-gray-700' },
  { type: 'weight', name: '重物', icon: Box, color: '#34495e', bgClass: 'from-slate-600 to-slate-800' },
];

const constraintTypeConfigs: { type: ConstraintType; name: string; icon: typeof Link; color: string; bgClass: string }[] = [
  { type: 'spring', name: '弹簧', icon: Scaling, color: '#ff6b6b', bgClass: 'from-rose-500 to-pink-600' },
  { type: 'rope', name: '绳索', icon: Link, color: '#feca57', bgClass: 'from-amber-500 to-yellow-600' },
  { type: 'hinge', name: '铰链', icon: RotateCw, color: '#48dbfb', bgClass: 'from-cyan-500 to-blue-600' },
  { type: 'pulley', name: '滑轮', icon: Circle, color: '#ff9ff3', bgClass: 'from-pink-400 to-fuchsia-600' },
  { type: 'distance', name: '距离', icon: Minus, color: '#54a0ff', bgClass: 'from-blue-400 to-indigo-600' },
];

const labToolConfigs: { type: LabTool; name: string; icon: typeof Plus; color: string }[] = [
  { type: 'placeObject', name: '放置物体', icon: Plus, color: 'from-emerald-500 to-green-600' },
  { type: 'placeConstraint', name: '添加约束', icon: Link, color: 'from-blue-500 to-indigo-600' },
  { type: 'select', name: '选择', icon: Eye, color: 'from-purple-500 to-violet-600' },
  { type: 'delete', name: '删除', icon: Trash2, color: 'from-red-500 to-rose-600' },
];

export function ControlPanel({ onReset, onRegenerateBuilding, onClearBuild, onResetRoboticArm, onResetPhysicsLab, onLoadBlueprint }: ControlPanelProps) {
  const weapon = useGameStore((s) => s.weapon);
  const setWeapon = useGameStore((s) => s.setWeapon);
  const weaponCustomizations = useGameStore((s) => s.weaponCustomizations);
  const upgradeWeapon = useGameStore((s) => s.upgradeWeapon);
  const setWeaponAppearance = useGameStore((s) => s.setWeaponAppearance);
  const resetWeaponCustomizations = useGameStore((s) => s.resetWeaponCustomizations);
  const blocks = useGameStore((s) => s.blocks);
  const shootCooldown = useGameStore((s) => s.shootCooldown);
  const wreckingBallActive = useGameStore((s) => s.wreckingBallActive);
  const gameMode = useGameStore((s) => s.gameMode);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const setBuildMaterial = useGameStore((s) => s.setBuildMaterial);
  const buildTool = useGameStore((s) => s.buildTool);
  const setBuildTool = useGameStore((s) => s.setBuildTool);
  const undoStack = useGameStore((s) => s.undoStack);
  const redoStack = useGameStore((s) => s.redoStack);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const sprayColor = useGameStore((s) => s.sprayColor);
  const setSprayColor = useGameStore((s) => s.setSprayColor);
  const spraySize = useGameStore((s) => s.spraySize);
  const setSpraySize = useGameStore((s) => s.setSpraySize);
  const gravityDirection = useGameStore((s) => s.gravityDirection);
  const setGravityDirection = useGameStore((s) => s.setGravityDirection);
  const roboticArm = useGameStore((s) => s.roboticArm);
  const setRoboticArmBaseAngle = useGameStore((s) => s.setRoboticArmBaseAngle);
  const setRoboticArmShoulderAngle = useGameStore((s) => s.setRoboticArmShoulderAngle);
  const setRoboticArmElbowAngle = useGameStore((s) => s.setRoboticArmElbowAngle);
  const setRoboticArmWristAngle = useGameStore((s) => s.setRoboticArmWristAngle);
  const setRoboticArmGripperOpen = useGameStore((s) => s.setRoboticArmGripperOpen);
  const resetRoboticArm = useGameStore((s) => s.resetRoboticArm);

  const labObjects = useGameStore((s) => s.labObjects);
  const labConstraints = useGameStore((s) => s.labConstraints);
  const labTool = useGameStore((s) => s.labTool);
  const selectedLabObjectType = useGameStore((s) => s.selectedLabObjectType);
  const selectedConstraintType = useGameStore((s) => s.selectedConstraintType);
  const constraintStartObjectId = useGameStore((s) => s.constraintStartObjectId);
  const springStiffness = useGameStore((s) => s.springStiffness);
  const springDamping = useGameStore((s) => s.springDamping);
  const ropeLength = useGameStore((s) => s.ropeLength);
  const setLabTool = useGameStore((s) => s.setLabTool);
  const setSelectedLabObjectType = useGameStore((s) => s.setSelectedLabObjectType);
  const setSelectedConstraintType = useGameStore((s) => s.setSelectedConstraintType);
  const setSpringStiffness = useGameStore((s) => s.setSpringStiffness);
  const setSpringDamping = useGameStore((s) => s.setSpringDamping);
  const setRopeLength = useGameStore((s) => s.setRopeLength);
  const resetPhysicsLab = useGameStore((s) => s.resetPhysicsLab);

  const blueprints = useGameStore((s) => s.blueprints);
  const saveBlueprint = useGameStore((s) => s.saveBlueprint);
  const loadBlueprint = useGameStore((s) => s.loadBlueprint);
  const deleteBlueprint = useGameStore((s) => s.deleteBlueprint);
  const [blueprintName, setBlueprintName] = useState('');
  const [showBlueprintPanel, setShowBlueprintPanel] = useState(false);

  const totalBlocks = blocks.size;

  if (gameMode === 'roboticArm') {
    const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI);
    const basePercent = ((toDeg(roboticArm.baseAngle) + 180) / 360) * 100;
    const shoulderPercent = ((toDeg(roboticArm.shoulderAngle) + 135) / 180) * 100;
    const elbowPercent = ((toDeg(roboticArm.elbowAngle) - 20) / 150) * 100;
    const wristPercent = ((toDeg(roboticArm.wristAngle) + 90) / 180) * 100;

    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">机械臂操控</h1>
                <p className="text-white/50 text-xs">关节控制 · 抓取抛掷</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs font-medium">底座旋转</span>
                  <span className="text-white/50 text-xs font-mono">{toDeg(roboticArm.baseAngle)}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={toDeg(roboticArm.baseAngle)}
                  onChange={(e) => setRoboticArmBaseAngle((parseInt(e.target.value) * Math.PI) / 180)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${basePercent}%, rgba(255,255,255,0.1) ${basePercent}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs font-medium">肩关节</span>
                  <span className="text-white/50 text-xs font-mono">{toDeg(roboticArm.shoulderAngle)}°</span>
                </div>
                <input
                  type="range"
                  min={-135}
                  max={45}
                  value={toDeg(roboticArm.shoulderAngle)}
                  onChange={(e) => setRoboticArmShoulderAngle((parseInt(e.target.value) * Math.PI) / 180)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${shoulderPercent}%, rgba(255,255,255,0.1) ${shoulderPercent}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs font-medium">肘关节</span>
                  <span className="text-white/50 text-xs font-mono">{toDeg(roboticArm.elbowAngle)}°</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={170}
                  value={toDeg(roboticArm.elbowAngle)}
                  onChange={(e) => setRoboticArmElbowAngle((parseInt(e.target.value) * Math.PI) / 180)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #f97316 0%, #f97316 ${elbowPercent}%, rgba(255,255,255,0.1) ${elbowPercent}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs font-medium">腕关节</span>
                  <span className="text-white/50 text-xs font-mono">{toDeg(roboticArm.wristAngle)}°</span>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={toDeg(roboticArm.wristAngle)}
                  onChange={(e) => setRoboticArmWristAngle((parseInt(e.target.value) * Math.PI) / 180)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #eab308 0%, #eab308 ${wristPercent}%, rgba(255,255,255,0.1) ${wristPercent}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex gap-2">
                <button
                  onClick={() => setRoboticArmGripperOpen(!roboticArm.gripperOpen)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                    roboticArm.gripperOpen
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
                      : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30'
                  }`}
                >
                  <Grip className="w-5 h-5 text-white" />
                  <span className="text-white text-sm font-medium">
                    {roboticArm.gripperOpen ? '张开' : '夹紧'}
                  </span>
                </button>
                <button
                  onClick={onResetRoboticArm}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                  title="重置场景"
                >
                  <RefreshCw className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {roboticArm.isGrabbing && (
              <div className="mt-3 p-2.5 rounded-xl bg-green-500/20 border border-green-500/30">
                <div className="text-green-300 text-xs flex items-center gap-1.5">
                  <Grip className="w-3.5 h-3.5" />
                  <span>已抓取方块，空格键释放</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider">模式切换</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGameMode('physicsLab')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到物理实验室</div>
                  <div className="text-white/50 text-xs">弹簧绳索铰链滑轮</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('destroy')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到破坏模式</div>
                  <div className="text-white/50 text-xs">使用武器摧毁建筑</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('build')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到建造模式</div>
                  <div className="text-white/50 text-xs">自由建造创意建筑</div>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider flex items-center gap-2">
                <span>重力方向</span>
                <span className="text-xs font-normal text-white/50">
                  {GRAVITY_LABELS[gravityDirection]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {gravityConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = gravityDirection === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setGravityDirection(config.type)}
                      className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      title={config.name}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">场景方块</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    {totalBlocks}
                  </span>
                  <span className="text-white/40 text-sm">块</span>
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">抓取状态</div>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      roboticArm.isGrabbing ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`}
                  />
                  <span className="text-white/80 text-sm">
                    {roboticArm.isGrabbing ? '已抓取' : '空闲'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">W / S</span>
                <span>肩关节上下</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">A / D</span>
                <span>底座左右旋转</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Q / E</span>
                <span>肘关节弯曲</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Z / X</span>
                <span>腕关节旋转</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">空格</span>
                <span>抓取 / 释放</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">R</span>
                <span>重置机械臂</span>
              </div>
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="text-white/60 text-xs">
                  💡 提示：快速移动机械臂时释放方块可以抛掷
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === 'build') {
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">自由建造</h1>
                <p className="text-white/50 text-xs">点击网格 · 自由创造</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">材质选择</div>
              <div className="grid grid-cols-3 gap-2">
                {materialConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = buildMaterial === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setBuildMaterial(config.type)}
                      className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.bgClass} border-white/30 shadow-lg scale-105`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">工具选择</div>
              <div className="grid grid-cols-4 gap-1.5">
                {toolConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = buildTool === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setBuildTool(config.type)}
                      className={`relative group p-2 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-200 ${
                  undoStack.length > 0
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    : 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-4 h-4" />
                <span className="text-xs">撤销</span>
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-200 ${
                  redoStack.length > 0
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    : 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-4 h-4" />
                <span className="text-xs">重做</span>
              </button>
            </div>

            {buildTool === 'sprayPaint' && (
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">喷枪颜色</div>
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {SPRAY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSprayColor(color)}
                      className={`relative w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                        sprayColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/10 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">笔触大小</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={spraySize}
                    onChange={(e) => setSpraySize(parseInt(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${sprayColor} 0%, ${sprayColor} ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                  <span className="text-white text-xs font-mono w-10 text-right">{spraySize}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGameMode('destroy')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到破坏模式</div>
                  <div className="text-white/50 text-xs">使用武器摧毁建筑</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('physicsLab')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到物理实验室</div>
                  <div className="text-white/50 text-xs">弹簧绳索铰链滑轮</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('roboticArm')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到机械臂模式</div>
                  <div className="text-white/50 text-xs">操控机械臂抓取抛掷</div>
                </div>
              </button>
              <button
                onClick={onClearBuild}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">清空建造</div>
                  <div className="text-white/50 text-xs">清除所有方块</div>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/70 text-xs font-medium uppercase tracking-wider">蓝图管理</div>
                <button
                  onClick={() => setShowBlueprintPanel(!showBlueprintPanel)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${
                    showBlueprintPanel
                      ? 'bg-indigo-500/30 border border-indigo-400/40 text-indigo-200'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10'
                  }`}
                >
                  {showBlueprintPanel ? <X className="w-3 h-3" /> : <FolderOpen className="w-3 h-3" />}
                  {showBlueprintPanel ? '收起' : '展开'}
                </button>
              </div>

              {showBlueprintPanel && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={blueprintName}
                      onChange={(e) => setBlueprintName(e.target.value)}
                      placeholder="输入蓝图名称..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && blueprintName.trim() && totalBlocks > 0) {
                          saveBlueprint(blueprintName.trim());
                          setBlueprintName('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (blueprintName.trim() && totalBlocks > 0) {
                          saveBlueprint(blueprintName.trim());
                          setBlueprintName('');
                        }
                      }}
                      disabled={!blueprintName.trim() || totalBlocks === 0}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
                        blueprintName.trim() && totalBlocks > 0
                          ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border border-indigo-400/40 text-indigo-200 hover:from-indigo-500/40 hover:to-purple-500/40'
                          : 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      <Save className="w-3 h-3" />
                      保存
                    </button>
                  </div>

                  {totalBlocks === 0 && (
                    <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="text-yellow-300/80 text-xs">场景中没有方块，无法保存</div>
                    </div>
                  )}

                  {blueprints.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {blueprints.map((bp) => (
                        <div
                          key={bp.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all duration-200 group"
                        >
                          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-medium truncate">{bp.name}</div>
                            <div className="text-white/40 text-[10px]">
                              {bp.blocks.length}块 · {new Date(bp.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => loadBlueprint(bp.id)}
                            className="p-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all"
                            title="加载蓝图"
                          >
                            <FolderOpen className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteBlueprint(bp.id)}
                            className="p-1.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all"
                            title="删除蓝图"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {blueprints.length === 0 && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                      <div className="text-white/30 text-xs">暂无已保存的蓝图</div>
                      <div className="text-white/20 text-[10px] mt-1">建造后输入名称保存</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider flex items-center gap-2">
                <span>重力方向</span>
                <span className="text-xs font-normal text-white/50">
                  {GRAVITY_LABELS[gravityDirection]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {gravityConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = gravityDirection === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setGravityDirection(config.type)}
                      className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      title={config.name}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">已放置方块</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {totalBlocks}
                  </span>
                  <span className="text-white/40 text-sm">块</span>
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">可撤销</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-white/80">{undoStack.length}</span>
                  <span className="text-white/40 text-sm">步</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
            <div className="space-y-2 text-sm">
              {buildTool === 'place' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>在网格上放置方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                    <span>缩放视角</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">右键拖动</span>
                    <span>旋转视角</span>
                  </div>
                </>
              )}
              {buildTool === 'move' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>选择方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">拖拽</span>
                    <span>移动选中方块</span>
                  </div>
                  {selectedBlockId && (
                    <div className="mt-2 p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <div className="text-blue-300 text-xs">已选中方块，拖拽移动</div>
                    </div>
                  )}
                </>
              )}
              {buildTool === 'rotate' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>选择方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">R</span>
                    <span>旋转90度</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">方向箭头</span>
                    <span>点击箭头旋转</span>
                  </div>
                </>
              )}
              {buildTool === 'delete' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>删除方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Delete</span>
                    <span>删除选中</span>
                  </div>
                </>
              )}
              {buildTool === 'sprayPaint' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键按住</span>
                    <span>在方块表面喷涂</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">移动鼠标</span>
                    <span>绘制图案和文字</span>
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-pink-500/20 border border-pink-500/30">
                    <div className="text-pink-300 text-xs flex items-center gap-1">
                      <SprayCan className="w-3 h-3" />
                      在左侧面板选择颜色和笔触大小
                    </div>
                  </div>
                </>
              )}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Ctrl+Z</span>
                  <span>撤销</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 mt-1">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Ctrl+Y</span>
                  <span>重做</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 mt-1">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Esc</span>
                  <span>取消选择</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === 'physicsLab') {
    const totalLabObjects = labObjects.size;
    const totalConstraints = labConstraints.size;

    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">物理实验室</h1>
                <p className="text-white/50 text-xs">弹簧 · 绳索 · 铰链 · 滑轮</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">工具选择</div>
              <div className="grid grid-cols-4 gap-1.5">
                {labToolConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = labTool === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setLabTool(config.type)}
                      className={`relative group p-2 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {labTool === 'placeObject' && (
              <div className="mb-3">
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">物体类型</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {labObjectConfigs.map((config) => {
                    const Icon = config.icon;
                    const isActive = selectedLabObjectType === config.type;
                    return (
                      <button
                        key={config.type}
                        onClick={() => setSelectedLabObjectType(config.type)}
                        className={`relative group p-2 rounded-xl transition-all duration-300 border ${
                          isActive
                            ? `bg-gradient-to-br ${config.bgClass} border-white/30 shadow-lg scale-105`
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                          <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                            {config.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {labTool === 'placeConstraint' && (
              <div className="mb-3">
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">约束类型</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {constraintTypeConfigs.map((config) => {
                    const Icon = config.icon;
                    const isActive = selectedConstraintType === config.type;
                    return (
                      <button
                        key={config.type}
                        onClick={() => setSelectedConstraintType(config.type)}
                        className={`relative group p-2 rounded-xl transition-all duration-300 border ${
                          isActive
                            ? `bg-gradient-to-br ${config.bgClass} border-white/30 shadow-lg scale-105`
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                          <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                            {config.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {constraintStartObjectId && (
                  <div className="mt-2 p-2 rounded-lg bg-green-500/20 border border-green-500/30">
                    <div className="text-green-300 text-xs flex items-center gap-1.5">
                      <Unlink className="w-3.5 h-3.5" />
                      <span>已选择起点，点击第二个物体</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selectedConstraintType === 'spring' || labTool === 'placeConstraint') && (
              <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">
                  {selectedConstraintType === 'spring' ? '弹簧参数' : '约束参数'}
                </div>
                {selectedConstraintType === 'spring' && (
                  <>
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-xs">刚度</span>
                        <span className="text-white/50 text-xs font-mono">{springStiffness}</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={500}
                        value={springStiffness}
                        onChange={(e) => setSpringStiffness(parseInt(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #ff6b6b 0%, #ff6b6b ${((springStiffness - 10) / 490) * 100}%, rgba(255,255,255,0.1) ${((springStiffness - 10) / 490) * 100}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-xs">阻尼</span>
                        <span className="text-white/50 text-xs font-mono">{springDamping}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={springDamping}
                        onChange={(e) => setSpringDamping(parseInt(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #feca57 0%, #feca57 ${((springDamping - 1) / 49) * 100}%, rgba(255,255,255,0.1) ${((springDamping - 1) / 49) * 100}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                      />
                    </div>
                  </>
                )}
                {selectedConstraintType === 'rope' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/70 text-xs">绳长</span>
                      <span className="text-white/50 text-xs font-mono">{ropeLength.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={0.5}
                      value={ropeLength}
                      onChange={(e) => setRopeLength(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #feca57 0%, #feca57 ${((ropeLength - 1) / 14) * 100}%, rgba(255,255,255,0.1) ${((ropeLength - 1) / 14) * 100}%, rgba(255,255,255,0.1) 100%)`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onResetPhysicsLab}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-pink-500/30 transition-all duration-200 group"
            >
              <RotateCcw className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium">重置实验室</span>
            </button>
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider">模式切换</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGameMode('destroy')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到破坏模式</div>
                  <div className="text-white/50 text-xs">使用武器摧毁建筑</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('build')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到建造模式</div>
                  <div className="text-white/50 text-xs">自由建造创意建筑</div>
                </div>
              </button>
              <button
                onClick={() => setGameMode('roboticArm')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到机械臂模式</div>
                  <div className="text-white/50 text-xs">操控机械臂抓取抛掷</div>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider flex items-center gap-2">
                <span>重力方向</span>
                <span className="text-xs font-normal text-white/50">
                  {GRAVITY_LABELS[gravityDirection]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {gravityConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = gravityDirection === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setGravityDirection(config.type)}
                      className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      title={config.name}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">物体数量</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    {totalLabObjects}
                  </span>
                  <span className="text-white/40 text-sm">个</span>
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">约束数量</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-white/80">{totalConstraints}</span>
                  <span className="text-white/40 text-sm">个</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
            <div className="space-y-2 text-sm">
              {labTool === 'placeObject' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>放置物理物体</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                    <span>缩放视角</span>
                  </div>
                </>
              )}
              {labTool === 'placeConstraint' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">点击第一个物体</span>
                    <span>选择约束起点</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">点击第二个物体</span>
                    <span>创建约束连接</span>
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                    <div className="text-cyan-300 text-xs flex items-center gap-1">
                      <Link className="w-3 h-3" />
                      弹簧/绳索/铰链/距离约束自由组合
                    </div>
                  </div>
                </>
              )}
              {labTool === 'select' && (
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                  <span>选中物体</span>
                </div>
              )}
              {labTool === 'delete' && (
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                  <span>删除物体及约束</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">右键拖动</span>
                  <span>旋转视角</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Hammer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">解压破坏场</h1>
              <p className="text-white/50 text-xs">无任务 · 无分数 · 尽情破坏</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">武器选择</div>
            <div className="grid grid-cols-3 gap-2">
              {weaponConfigs.map((config) => {
                const Icon = config.icon;
                const isActive = weapon === config.type;
                return (
                  <button
                    key={config.type}
                    onClick={() => setWeapon(config.type)}
                    className={`relative group p-3 rounded-xl transition-all duration-300 border ${
                      isActive
                        ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/70'}`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {config.name}
                      </span>
                    </div>
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-3 rounded-xl bg-gradient-to-r ${weaponConfigs.find(w => w.type === weapon)?.color} border border-white/20`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const Icon = weaponConfigs.find(w => w.type === weapon)?.icon || Hammer;
                  return <Icon className="w-4 h-4 text-white" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">
                  {weaponConfigs.find(w => w.type === weapon)?.name}
                </div>
                <div className="text-white/80 text-xs mt-0.5">
                  {weaponConfigs.find(w => w.type === weapon)?.description}
                </div>
              </div>
            </div>
          </div>

          {weapon !== 'sprayPaint' && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/70 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <ChevronUp className="w-3.5 h-3.5" />
                  属性升级
                </div>
                <button
                  onClick={resetWeaponCustomizations}
                  className="text-white/40 text-[10px] hover:text-white/70 transition-colors"
                  title="重置所有武器自定义"
                >
                  重置
                </button>
              </div>
              <div className="space-y-2">
                {(['damage', 'speed', 'radius'] as WeaponUpgradeKey[]).map((key) => {
                  const level = weaponCustomizations[weapon].upgrades[key];
                  const multiplier = UPGRADE_MULTIPLIERS[key](level);
                  const Icon = UPGRADE_ICONS[key];
                  const isMaxed = level >= UPGRADE_MAX_LEVEL;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${UPGRADE_COLORS[key]}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/80 text-xs">{UPGRADE_LABELS[key]}</span>
                          <span className="text-white/50 text-[10px] font-mono">×{multiplier.toFixed(1)}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: UPGRADE_MAX_LEVEL }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (i + 1 > level) upgradeWeapon(weapon, key);
                              }}
                              className={`flex-1 h-1.5 rounded-full transition-all duration-200 ${
                                i < level
                                  ? `bg-gradient-to-r ${UPGRADE_COLORS[key]}`
                                  : isMaxed
                                  ? 'bg-white/10'
                                  : 'bg-white/10 hover:bg-white/25 cursor-pointer'
                              }`}
                              disabled={isMaxed}
                            />
                          ))}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono w-5 text-right ${isMaxed ? 'text-yellow-400' : 'text-white/40'}`}>
                        {level}/{UPGRADE_MAX_LEVEL}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {weapon !== 'sprayPaint' && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                外观自定义
              </div>

              <div className="mb-3">
                <div className="text-white/60 text-[10px] mb-1.5 font-medium">武器颜色</div>
                <div className="grid grid-cols-6 gap-1">
                  {APPEARANCE_COLORS.map((color) => (
                    <button
                      key={`main-${color}`}
                      onClick={() => setWeaponAppearance(weapon, 'mainColor', color)}
                      className={`relative w-full aspect-square rounded-md transition-all duration-200 border-2 ${
                        weaponCustomizations[weapon].appearance.mainColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/5 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-white/60 text-[10px] mb-1.5 font-medium">拖尾颜色</div>
                <div className="grid grid-cols-6 gap-1">
                  {APPEARANCE_COLORS.map((color) => (
                    <button
                      key={`trail-${color}`}
                      onClick={() => setWeaponAppearance(weapon, 'trailColor', color)}
                      className={`relative w-full aspect-square rounded-md transition-all duration-200 border-2 ${
                        weaponCustomizations[weapon].appearance.trailColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/5 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-white/60 text-[10px] mb-1.5 font-medium">发光颜色</div>
                <div className="grid grid-cols-6 gap-1">
                  {APPEARANCE_COLORS.map((color) => (
                    <button
                      key={`glow-${color}`}
                      onClick={() => setWeaponAppearance(weapon, 'glowColor', color)}
                      className={`relative w-full aspect-square rounded-md transition-all duration-200 border-2 ${
                        weaponCustomizations[weapon].appearance.glowColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/5 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-white/60 text-[10px] mb-1.5 font-medium">特效类型</div>
                <div className="grid grid-cols-5 gap-1">
                  {(['none', 'fire', 'electric', 'rainbow', 'shadow'] as WeaponEffectType[]).map((effect) => (
                    <button
                      key={effect}
                      onClick={() => setWeaponAppearance(weapon, 'effectType', effect)}
                      className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all duration-200 border ${
                        weaponCustomizations[weapon].appearance.effectType === effect
                          ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-indigo-400/40 scale-105'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-sm">{EFFECT_ICONS[effect]}</span>
                      <span className={`text-[9px] ${weaponCustomizations[weapon].appearance.effectType === effect ? 'text-white' : 'text-white/50'}`}>
                        {EFFECT_TYPE_LABELS[effect]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {weaponCustomizations[weapon].appearance.effectType !== 'none' && (
                <button
                  onClick={() => {
                    const colors = EFFECT_COLORS[weaponCustomizations[weapon].appearance.effectType];
                    setWeaponAppearance(weapon, 'mainColor', colors.main);
                    setWeaponAppearance(weapon, 'trailColor', colors.trail);
                    setWeaponAppearance(weapon, 'glowColor', colors.glow);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 hover:from-indigo-500/30 hover:to-purple-500/30 transition-all duration-200"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-indigo-300 text-xs">应用{EFFECT_TYPE_LABELS[weaponCustomizations[weapon].appearance.effectType]}配色</span>
                </button>
              )}
            </div>
          )}

          {shootCooldown && weapon !== 'wreckingBall' && (
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-cyan-400 animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          {weapon === 'sprayPaint' && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">喷枪颜色</div>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {SPRAY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSprayColor(color)}
                    className={`relative w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                      sprayColor === color
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-white/10 hover:border-white/30 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">笔触大小</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={spraySize}
                  onChange={(e) => setSpraySize(parseInt(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${sprayColor} 0%, ${sprayColor} ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <span className="text-white text-xs font-mono w-10 text-right">{spraySize}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider">场景控制</div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setGameMode('physicsLab')}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">切换到物理实验室</div>
                <div className="text-white/50 text-xs">弹簧绳索铰链滑轮</div>
              </div>
            </button>
            <button
              onClick={() => setGameMode('roboticArm')}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">切换到机械臂模式</div>
                <div className="text-white/50 text-xs">操控机械臂抓取抛掷</div>
              </div>
            </button>
            <button
              onClick={() => setGameMode('build')}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">切换到建造模式</div>
                <div className="text-white/50 text-xs">自由建造创意建筑</div>
              </div>
            </button>
            <button
              onClick={() => onRegenerateBuilding('building')}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">生成办公楼</div>
                <div className="text-white/50 text-xs">多层现代建筑</div>
              </div>
            </button>
            <button
              onClick={() => onRegenerateBuilding('castle')}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Castle className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">生成城堡</div>
                <div className="text-white/50 text-xs">坚固的中世纪堡垒</div>
              </div>
            </button>
            {blueprints.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-white/50 text-[10px] uppercase tracking-wider px-1">加载蓝图</div>
                {blueprints.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => onLoadBlueprint(bp)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-white text-xs font-medium truncate">{bp.name}</div>
                      <div className="text-white/40 text-[10px]">{bp.blocks.length}块</div>
                    </div>
                    <FolderOpen className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60" />
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-pink-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">重置场景</div>
                <div className="text-white/50 text-xs">清除所有废墟</div>
              </div>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider flex items-center gap-2">
              <span>重力方向</span>
              <span className="text-xs font-normal text-white/50">
                {GRAVITY_LABELS[gravityDirection]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {gravityConfigs.map((config) => {
                const Icon = config.icon;
                const isActive = gravityDirection === config.type;
                return (
                  <button
                    key={config.type}
                    onClick={() => setGravityDirection(config.type)}
                    className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                      isActive
                        ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                    title={config.name}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                      <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {config.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider">剩余建筑方块</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {totalBlocks}
                </span>
                <span className="text-white/40 text-sm">块</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider">破坏进度</div>
              <div className="w-32 h-2 mt-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (1 - totalBlocks / 200) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
          <div className="space-y-2 text-sm">
            {weapon === 'wreckingBall' ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键拖拽</span>
                  <span>瞄准落锤方向</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">释放</span>
                  <span>释放推动铁球</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">鼠标</span>
                  <span>拖动旋转视角</span>
                </div>
                {wreckingBallActive && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                    <div className="text-emerald-300 text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      拖拽瞄准 → 释放挥动
                    </div>
                  </div>
                )}
              </>
            ) : weapon === 'sprayPaint' ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键按住</span>
                  <span>在方块表面喷涂</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">移动鼠标</span>
                  <span>绘制图案和文字</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                  <span>缩放视角</span>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-pink-500/20 border border-pink-500/30">
                  <div className="text-pink-300 text-xs flex items-center gap-1">
                    <SprayCan className="w-3 h-3" />
                    破坏方块后碎片会保留涂鸦颜色
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键</span>
                  <span>
                    {weapon === 'steelBall' ? '发射钢球' : '投掷爆炸物'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                  <span>缩放视角</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">右键拖动</span>
                  <span>平移视角</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {weapon !== 'wreckingBall' && (
          <div className="relative">
            <div className="absolute w-6 h-0.5 bg-white/50 -left-3 top-1/2 -translate-y-1/2" />
            <div className="absolute w-0.5 h-6 bg-white/50 left-1/2 -top-3 -translate-x-1/2" />
            <div className={`w-3 h-3 rounded-full border-2 ${
              weapon === 'explosive' ? 'border-orange-400 bg-orange-400/30' : 'border-cyan-400 bg-cyan-400/30'
            } backdrop-blur-sm`} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ControlPanel;
