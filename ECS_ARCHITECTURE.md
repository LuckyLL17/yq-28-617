# 游戏 ECS 核心实现原理

## 目录

- [1. ECS 架构概述](#1-ecs-架构概述)
- [2. 核心数据结构](#2-核心数据结构)
  - [2.1 Entity（实体）](#21-entity实体)
  - [2.2 Component（组件）](#22-component组件)
  - [2.3 ComponentStore（组件存储）](#23-componentstore组件存储)
  - [2.4 World（世界）](#24-world世界)
  - [2.5 System（系统）与 SystemManager](#25-system系统与-systemmanager)
- [3. 组件类型详解](#3-组件类型详解)
  - [3.1 数据组件](#31-数据组件)
  - [3.2 标签组件](#32-标签组件)
  - [3.3 原型（Archetype）](#33-原型archetype)
- [4. 系统职责与交互](#4-系统职责与交互)
  - [4.1 BlockSystem（方块系统）](#41-blocksystem方块系统)
  - [4.2 ParticleSystem（粒子系统）](#42-particlesystem粒子系统)
  - [4.3 ExplosionSystem（爆炸系统）](#43-explosionsystem爆炸系统)
  - [4.4 WeaponSystem（武器系统）](#44-weaponsystem武器系统)
  - [4.5 BuildSystem（建造系统）](#45-buildsystem建造系统)
  - [4.6 PhysicsLabSystem（物理实验室系统）](#46-physicslabsystem物理实验室系统)
  - [4.7 RoboticArmSystem（机械臂系统）](#47-roboticarmsystem机械臂系统)
  - [4.8 BlueprintSystem（蓝图系统）](#48-blueprintsystem蓝图系统)
  - [4.9 AudioSystem（音频系统）](#49-audiosystem音频系统)
- [5. 状态管理与数据流](#5-状态管理与数据流)
  - [5.1 Zustand + ECS 混合架构](#51-zustand--ecs-混合架构)
  - [5.2 数据同步机制](#52-数据同步机制)
  - [5.3 渲染循环与物理步进](#53-渲染循环与物理步进)
- [6. 系统间协作流程](#6-系统间协作流程)
  - [6.1 方块破坏流程](#61-方块破坏流程)
  - [6.2 爆炸伤害流程](#62-爆炸伤害流程)
  - [6.3 建造撤销/重做流程](#63-建造撤销重做流程)
- [7. 设计特点与优缺点](#7-设计特点与优缺点)

---

## 1. ECS 架构概述

本项目采用 **ECS（Entity-Component-System）** 架构模式，核心代码位于 [src/ecs/](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs) 目录。

### 架构分层

```
┌─────────────────────────────────────────┐
│           React UI 层                    │
│  (GameScene, Block, WeaponSystem...)    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Zustand Store 层                 │
│         (useGameStore)                  │
└──────────────────┬──────────────────────┘
                   │ 调用系统函数操作World
┌──────────────────▼──────────────────────┐
│            Systems 层                    │
│  (Block/Particle/Explosion/Build...)    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          ECS Core 层                     │
│  (World, ComponentStore, Entity)        │
└─────────────────────────────────────────┘
```

### 设计理念

- **数据驱动**：所有游戏数据存储在 ECS World 中，由组件构成
- **行为分离**：逻辑封装在 System 函数中，操作 World 中的数据
- **关注点分离**：渲染层（React/Three.js）、状态层（Zustand）、逻辑层（ECS Systems）、数据层（ECS World）各司其职

---

## 2. 核心数据结构

### 2.1 Entity（实体）

实体只是一个 **ID 字符串**，本身不包含任何数据。

```typescript
export type EntityId = string;
```

- 实体通过 `World.createEntity(id?)` 创建
- 实体通过 `World.destroyEntity(id)` 销毁
- 实体是组件的"容器"，通过 ID 关联多个组件

**关键代码位置**：[core.ts#L1](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts#L1-L1)

---

### 2.2 Component（组件）

组件是**纯数据结构**，不包含任何行为逻辑。

```typescript
export interface IComponent {
  readonly _type: string;  // 组件类型标识
}
```

每个组件都有一个 `_type` 字段用于标识类型，其他字段存储具体数据。

**关键代码位置**：[core.ts#L3-L7](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts#L3-L7)

---

### 2.3 ComponentStore（组件存储）

采用 **"类型 → Map<EntityId, Component>"** 的存储结构，即每种组件类型有一个独立的 Map。

```typescript
export class ComponentStore {
  private stores: Map<string, Map<EntityId, IComponent>> = new Map();
  
  add(entityId, component)    // 添加组件
  remove(entityId, type)      // 移除组件
  get(entityId, type)         // 获取组件
  has(entityId, type)         // 检查组件
  getAll(type)                // 获取某类型全部组件
  removeEntity(entityId)      // 移除某实体的所有组件
  clear()                     // 清空全部
}
```

**设计优势**：
- 按类型存储，查询某类组件时只需遍历一个 Map
- 内存局部性好，同类型组件数据连续存储
- 添加/删除组件是 O(1) 操作（Map 的 set/delete）

**关键代码位置**：[core.ts#L9-L54](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts#L9-L54)

---

### 2.4 World（世界）

World 是 ECS 的核心容器，管理实体、组件和查询。

```typescript
export class World {
  private entities: Set<EntityId>;                           // 所有实体ID
  private _componentStore: ComponentStore;                    // 组件存储
  private entityComponents: Map<EntityId, Set<string>>;       // 实体->组件类型映射

  createEntity(id?)                          // 创建实体
  destroyEntity(id)                          // 销毁实体
  addComponent(entityId, component)          // 添加组件
  removeComponent(entityId, type)            // 移除组件
  getComponent<T>(entityId, type)            // 获取组件
  hasComponent(entityId, type)               // 检查组件
  query(...componentTypes)                   // 查询拥有指定组件的实体
  getEntityIds()                             // 获取全部实体
  clear()                                    // 清空世界
}
```

#### 查询机制（Query）

`query()` 方法用于查找拥有**全部**指定组件类型的实体：

```typescript
query(...componentTypes: string[]): EntityId[] {
  const result: EntityId[] = [];
  this.entities.forEach((id) => {
    const types = this.entityComponents.get(id);
    if (types && componentTypes.every((t) => types.has(t))) {
      result.push(id);
    }
  });
  return result;
}
```

**实现方式**：
- 遍历所有实体，检查每个实体的组件类型集合是否包含全部查询类型
- 使用 `entityComponents` 映射加速检查（Set.has 是 O(1)）

> **注意**：这是一个简单的全表扫描实现，对于实体数量不多的场景（如本游戏）足够高效。若实体数量巨大，可优化为按最小组件类型的存储进行过滤。

**关键代码位置**：[core.ts#L56-L125](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts#L56-L125)

---

### 2.5 System（系统）与 SystemManager

系统是处理逻辑的单元，对 World 中的实体和组件进行操作。

```typescript
export type SystemUpdateFn = (world: World, dt: number) => void;

export interface ISystem {
  readonly name: string;
  update: SystemUpdateFn;
}

export class SystemManager {
  private systems: Map<string, ISystem>;
  private executionOrder: string[];

  register(system)           // 注册系统
  unregister(name)           // 注销系统
  update(world, dt)          // 按顺序执行所有系统
  get(name)                  // 获取系统
}
```

> **注意**：本项目中 `SystemManager` 定义了但并未在主循环中使用。各系统以**纯函数模块**的形式存在，由 Zustand Store 直接调用，而非通过 SystemManager 统一调度。

**关键代码位置**：[core.ts#L127-L157](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts#L127-L157)

---

## 3. 组件类型详解

所有组件定义在 [components.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/components.ts) 中。

### 3.1 数据组件

| 组件类型 | 字段 | 用途 |
|---------|------|------|
| **Transform** | position, rotation, size | 空间变换：位置、旋转、尺寸 |
| **Health** | health, maxHealth | 生命值与最大生命值 |
| **Material** | material | 材质类型（wood/glass/concrete） |
| **Spray** | sprayTextureVersion | 喷漆纹理版本号（用于触发更新） |
| **Visual** | color, size, life, maxLife | 视觉属性：颜色、大小、生命周期 |
| **Velocity** | velocity | 速度向量 |
| **Explosion** | radius | 爆炸半径 |
| **PhysicsBody** | mass, isStatic, radius?, height? | 物理刚体属性 |
| **LabConstraint** | constraintType, bodyAId, bodyBId, ... | 物理约束（弹簧/绳索/铰链等） |

### 3.2 标签组件

标签组件不包含数据，仅用于**标识实体类型**，便于查询过滤：

| 标签组件 | 用途 |
|---------|------|
| **BlockTag** | 标识方块实体 |
| **ParticleTag** | 标识粒子实体 |
| **ExplosionTag** | 标识爆炸实体 |
| **LabObjectTag** | 标识物理实验室对象 |

### 3.3 原型（Archetype）

原型预定义了某类实体应具备的组件组合：

```typescript
// 方块原型：标签 + 变换 + 生命 + 材质 + 喷漆
export const BLOCK_ARCHETYPE = [
  ComponentType.BlockTag,
  ComponentType.Transform,
  ComponentType.Health,
  ComponentType.Material,
  ComponentType.Spray,
] as const;

// 粒子原型：标签 + 变换 + 速度 + 视觉
export const PARTICLE_ARCHETYPE = [
  ComponentType.ParticleTag,
  ComponentType.Transform,
  ComponentType.Velocity,
  ComponentType.Visual,
] as const;

// 爆炸原型：标签 + 变换 + 爆炸 + 视觉
export const EXPLOSION_ARCHETYPE = [
  ComponentType.ExplosionTag,
  ComponentType.Transform,
  ComponentType.Explosion,
  ComponentType.Visual,
] as const;

// 物理实验室对象原型：标签 + 变换 + 物理体 + 视觉
export const LAB_OBJECT_ARCHETYPE = [
  ComponentType.LabObjectTag,
  ComponentType.Transform,
  ComponentType.PhysicsBody,
  ComponentType.Visual,
] as const;
```

**关键代码位置**：[components.ts#L1-L106](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/components.ts#L1-L106)

---

## 4. 系统职责与交互

所有系统位于 [src/ecs/systems/](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems) 目录下，以**纯函数模块**形式存在。

### 4.1 BlockSystem（方块系统）

**文件**：[block.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/block.ts)

**职责**：
- 方块实体的创建与销毁
- 方块生命值管理（伤害、死亡）
- 方块位置/旋转变换
- 方块喷漆纹理管理（Canvas 离屏渲染）
- 方块数据从 World 收集导出

**核心函数**：

| 函数 | 说明 |
|------|------|
| `addBlock(world, block)` | 创建方块实体并添加全部组件 |
| `removeBlock(world, id)` | 销毁方块实体及喷漆数据 |
| `damageBlock(world, id, damage)` | 对方块造成伤害，生命归零则销毁 |
| `updateBlockPosition(world, id, position)` | 更新方块位置 |
| `updateBlockRotation(world, id, rotation)` | 更新方块旋转 |
| `addSprayPoint(blockId, point, world)` | 添加喷漆点并更新纹理版本 |
| `collectBlocksFromWorld(world)` | 从 World 收集所有方块数据为 Map |
| `getBlockSprayCanvas(blockId)` | 获取方块喷漆 Canvas |
| `clearBlockSprayData()` | 清空全部喷漆数据 |

**设计特点**：
- 喷漆数据使用 `Map<string, HTMLCanvasElement>` 单独存储，不放入组件
- 使用 `sprayTextureVersion` 版本号机制通知 React 层重新渲染纹理
- `collectBlocksFromWorld` 作为 ECS → Store 的数据桥梁

---

### 4.2 ParticleSystem（粒子系统）

**文件**：[particle.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/particle.ts)

**职责**：
- 粒子实体的创建、销毁、更新
- 粒子数据收集导出

**核心函数**：

| 函数 | 说明 |
|------|------|
| `addParticle(world, particle)` | 创建粒子实体 |
| `removeParticle(world, id)` | 销毁粒子实体 |
| `updateParticle(world, id, data)` | 部分更新粒子数据 |
| `collectParticlesFromWorld(world)` | 收集所有粒子数据 |

---

### 4.3 ExplosionSystem（爆炸系统）

**文件**：[explosion.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/explosion.ts)

**职责**：
- 爆炸实体的创建、销毁、更新
- 爆炸数据收集导出

**核心函数**：

| 函数 | 说明 |
|------|------|
| `addExplosion(world, explosion)` | 创建爆炸实体 |
| `removeExplosion(world, id)` | 销毁爆炸实体 |
| `updateExplosion(world, id, data)` | 更新爆炸属性 |
| `collectExplosionsFromWorld(world)` | 收集所有爆炸数据 |

> **注意**：爆炸伤害逻辑并未放在 ExplosionSystem 中，而是在 `GameScene.tsx` 的 `handleExplosion` 函数内实现。爆炸系统仅管理数据，不处理伤害计算。

---

### 4.4 WeaponSystem（武器系统）

**文件**：[weapon.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/weapon.ts)

**职责**：
- 武器升级管理
- 武器外观定制
- 升级倍率计算

**核心函数**：

| 函数 | 说明 |
|------|------|
| `upgradeWeapon(customizations, weapon, key)` | 升级武器属性（damage/speed/radius） |
| `setWeaponAppearance(customizations, weapon, key, value)` | 设置武器外观 |
| `getWeaponUpgrade(customizations, weapon, key)` | 获取升级等级 |
| `getWeaponUpgradeMultiplier(customizations, weapon, key)` | 获取升级倍率 |
| `getWeaponAppearance(customizations, weapon)` | 获取外观配置 |
| `resetWeaponCustomizations()` | 重置武器配置 |

**设计特点**：
- 武器系统**不操作 World**，直接操作武器配置对象
- 属于"无状态"纯函数系统，输入配置输出新配置
- 武器实体本身不由 ECS 管理，由 React 组件直接管理

---

### 4.5 BuildSystem（建造系统）

**文件**：[build.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/build.ts)

**职责**：
- 建造操作的撤销/重做管理
- 建造状态清空

**核心数据结构**：

```typescript
type BuildAction =
  | { type: 'add'; block: BlockData }
  | { type: 'remove'; block: BlockData }
  | { type: 'move'; blockId: string; fromPosition: [...] ; toPosition: [...] }
  | { type: 'rotate'; blockId: string; fromRotation: [...] ; toRotation: [...] };
```

**核心函数**：

| 函数 | 说明 |
|------|------|
| `pushUndoAction(undoStack, action)` | 推入撤销操作，清空重做栈 |
| `applyUndo(world, undoStack, redoStack)` | 执行撤销，返回新状态 |
| `applyRedo(world, undoStack, redoStack)` | 执行重做，返回新状态 |
| `clearBuildState(world)` | 清空全部建造状态 |

**设计特点**：
- 采用**命令模式**实现撤销/重做
- 操作作用于 ECS World，同时维护 undoStack/redoStack 在 Zustand 中
- 最大撤销步数由 `MAX_UNDO_STEPS`（50步）限制

---

### 4.6 PhysicsLabSystem（物理实验室系统）

**文件**：[physicsLab.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/physicsLab.ts)

**职责**：
- 物理实验室对象（刚体）的创建、销毁、更新
- 物理约束（弹簧/绳索/铰链/滑轮/距离）的创建、销毁
- 实验室数据收集导出
- 实验室重置

**核心函数**：

| 函数 | 说明 |
|------|------|
| `addLabObject(world, obj)` | 添加物理实验室对象 |
| `removeLabObject(world, id)` | 移除对象及其关联约束 |
| `updateLabObjectPosition(world, id, position)` | 更新对象位置 |
| `addLabConstraint(world, constraint)` | 添加物理约束 |
| `removeLabConstraint(world, id)` | 移除约束 |
| `resetPhysicsLab(world)` | 重置整个实验室 |
| `collectLabObjectsFromWorld(world)` | 收集对象数据 |
| `collectLabConstraintsFromWorld(world)` | 收集约束数据 |

**设计特点**：
- 删除对象时会级联删除关联的约束（查询所有约束，检查 bodyAId/bodyBId）
- 约束本身也是一种实体，拥有 `LabConstraint` 组件

---

### 4.7 RoboticArmSystem（机械臂系统）

**文件**：[roboticArm.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/roboticArm.ts)

**职责**：
- 机械臂关节角度管理
- 机械臂夹爪状态管理
- 抓取方块状态管理

**核心函数**：

| 函数 | 说明 |
|------|------|
| `setRoboticArmField(arm, key, value)` | 设置机械臂某字段 |
| `resetRoboticArm()` | 重置机械臂到默认状态 |

**设计特点**：
- 机械臂状态**不存入 ECS World**，直接作为普通对象在 Zustand 中管理
- 是一个极简的不可变更新工具集

---

### 4.8 BlueprintSystem（蓝图系统）

**文件**：[blueprint.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/blueprint.ts)

**职责**：
- 蓝图（建筑存档）的保存与加载
- 蓝图数据持久化（localStorage）
- 蓝图删除

**核心函数**：

| 函数 | 说明 |
|------|------|
| `saveBlueprint(world, name, existingBlueprints, gravityDirection)` | 将当前世界保存为蓝图 |
| `loadBlueprint(world, blueprint)` | 从蓝图加载建筑到世界 |
| `deleteBlueprint(id, existingBlueprints)` | 删除蓝图 |
| `loadBlueprintsFromStorage()` | 从 localStorage 加载蓝图列表 |
| `saveBlueprintsToStorage(blueprints)` | 保存蓝图列表到 localStorage |

**设计特点**：
- 蓝图数据包含方块列表、重力方向、创建时间
- 加载蓝图会先清空当前世界再重建
- 使用 localStorage 实现本地持久化

---

### 4.9 AudioSystem（音频系统）

**文件**：[audio.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/audio.ts)

**职责**：
- 音频效果配置管理

**核心函数**：

| 函数 | 说明 |
|------|------|
| `updateAudioEffectsConfig(current, partial)` | 部分更新音频效果配置 |

---

## 5. 状态管理与数据流

### 5.1 Zustand + ECS 混合架构

本项目采用 **Zustand（UI 状态）+ ECS World（游戏数据）** 的混合架构。

**单例 ECS World**：

```typescript
const ecsWorld = new World();  // 全局单例
```

**Zustand Store 作为桥接层**：
- Store 不直接存储游戏数据的"真值"
- 真值存储在 `ecsWorld` 中
- Store 中的 `blocks`、`particles`、`explosions` 等 Map 是 ECS 数据的**快照/投影**
- Store 提供的 action 函数调用 System 函数操作 World，然后重新收集数据更新 Store

**关键代码位置**：[gameStore.ts#L281-L620](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/store/gameStore.ts#L281-L620)

---

### 5.2 数据同步机制

#### 写入流程（Action → ECS → Store）

```
用户操作
   ↓
Zustand Action (e.g. addBlock)
   ↓
调用 System 函数 (BlockSystem.addBlock(ecsWorld, block))
   ↓
ECS World 更新（添加实体+组件）
   ↓
调用 collectXxxFromWorld(ecsWorld) 收集数据
   ↓
set({ blocks: 新Map }) 更新 Zustand
   ↓
React 组件重新渲染
```

**示例代码**：

```typescript
addBlock: (block) => {
  BlockSystem.addBlock(ecsWorld, block);               // 写入 ECS
  set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });  // 同步到 Store
},
```

#### 读取流程（Store → React）

```typescript
const blocks = useGameStore((s) => s.blocks);  // React 组件订阅 Store
// blocks 是从 ECS 同步过来的 Map 快照
```

**设计权衡**：
- ✅ 优点：ECS 是单一数据源，数据一致性好
- ✅ 优点：React 层通过 Zustand 的选择器订阅实现精确重渲染
- ⚠️ 缺点：每次修改都需 `collectXxxFromWorld` 全量收集，大量实体时有性能开销
- ⚠️ 缺点：Store 中的 Map 每次都是新对象，可能导致不必要的重渲染

---

### 5.3 渲染循环与物理步进

#### 物理步进

```tsx
function PhysicsStepper({ step }: { step: (delta: number) => void }) {
  useFrame((_, delta) => {
    step(Math.min(delta, 1 / 30));  // 限制最大步长为 1/30 秒
  });
  return null;
}
```

- 使用 `@react-three/fiber` 的 `useFrame` 钩子，每帧调用物理步进
- 最大步长限制为 1/30 秒，防止帧率突降导致物理穿透

#### 渲染

- 方块、粒子等由 React 组件遍历 Store 中的 Map 渲染
- 物理引擎（cannon-es）与 ECS World 是两套独立体系
- 物理体通过 `usePhysics` hook 管理，与 ECS 中的 `PhysicsBody` 组件是两套数据

> **注意**：ECS 中的 `PhysicsBody` 和 `LabConstraint` 组件主要用于物理实验室模式的数据描述和持久化，实际物理模拟由 cannon-es 引擎独立进行，两者通过 ID 关联但数据不同步。

---

## 6. 系统间协作流程

### 6.1 方块破坏流程

```
武器/爆炸造成伤害
    ↓
damageBlock(id, damage)  [Zustand Action]
    ↓
BlockSystem.damageBlock(ecsWorld, id, damage)  [System]
    ↓
┌─ 读取 Health 组件
│  计算新生命值
│  若 ≤ 0 → removeBlock → destroyEntity
│  若 > 0 → 更新 Health 组件
└─→ collectBlocksFromWorld 重新收集
    ↓
set({ blocks: 新Map })  [Zustand 更新]
    ↓
React 组件检测变化 → 方块消失
    ↓
onDestroy 回调 → 生成粒子碎片
```

---

### 6.2 爆炸伤害流程

```
炮弹命中 → handleExplosion(position, radius)  [GameScene]
    ↓
┌─ 1. 创建爆炸视觉实体
│  2. 遍历所有 blocks（从 Zustand Store 读取）
│  3. 计算距离，应用伤害衰减
│  4. 调用 damageBlock(blockId, damage)
│     └─→ ECS World 更新 → Store 更新
│  5. 若方块被摧毁 → spawnParticles + spawnDebris
│  6. 生成爆炸粒子（addParticle × 100）
│     └─→ ParticleSystem.addParticle → ECS → Store
└─→ 爆炸动画播放完毕后 removeExplosion
```

**关键交互点**：
- 爆炸逻辑在 GameScene 组件中，不在 ExplosionSystem
- 爆炸对 Block 的伤害通过 Zustand Action 间接触发
- 粒子生成通过 ParticleSystem 写入 ECS

---

### 6.3 建造撤销/重做流程

```
用户操作方块（add/remove/move/rotate）
    ↓
pushUndoAction(action)  [Zustand Action]
    ↓
BuildSystem.pushUndoAction(undoStack, action)  [System]
    ↓
返回新 undoStack + 空 redoStack
    ↓
set({ undoStack, redoStack })  [Zustand 更新]
```

**撤销时**：

```
用户按撤销
    ↓
undo()  [Zustand Action]
    ↓
BuildSystem.applyUndo(ecsWorld, undoStack, redoStack)  [System]
    ↓
┌─ 弹出 undoStack 最后一个 action
│  执行反向操作：
│    add    → removeBlock(world)
│    remove → addBlock(world)
│    move   → 恢复 fromPosition
│    rotate → 恢复 fromRotation
│  action 推入 redoStack
└─→ collectBlocksFromWorld 重新收集
    ↓
set({ blocks, undoStack, redoStack, ... })  [Zustand 更新]
```

---

## 7. 设计特点与优缺点

### ✅ 优点

1. **清晰的关注点分离**：数据（ECS）、逻辑（Systems）、状态（Zustand）、渲染（React）四层分明
2. **数据驱动**：所有游戏实体由组件组合而成，扩展性好
3. **不可变更新**：System 函数返回新对象/状态，便于调试和时间旅行（撤销/重做）
4. **标签组件模式**：通过 Tag 组件快速分类实体，查询语义清晰
5. **原型预定义**：Archetype 常量提供了实体类型的文档化说明

### ⚠️ 待改进点

1. **SystemManager 未实际使用**：定义了但未接入主循环，系统调度是分散的
2. **全量收集同步**：每次修改都调用 `collectXxxFromWorld` 全量重建 Map，性能随实体数量线性下降
3. **物理与 ECS 脱节**：cannon-es 物理体和 ECS 组件是两套数据，未通过系统自动同步
4. **查询是 O(n) 全扫描**：`query()` 遍历全部实体，数量大时效率低
5. **部分系统不操作 World**：Weapon/RoboticArm/Audio 系统直接操作普通对象，与 ECS 关联较弱
6. **无固定更新循环**：没有统一的 `update(dt)` 驱动各系统，逻辑散落在 React 组件和事件回调中

### 🔧 优化方向

1. 引入真正的 System 主循环，用 `SystemManager.update(world, dt)` 统一驱动
2. 实现增量同步或细粒度订阅，减少全量收集
3. 增加物理同步系统，每帧将 cannon-es 的变换写回 ECS Transform 组件
4. 为高频查询建立索引（如按 Tag 预分组的实体列表）
5. 将 GameScene 中的爆炸、碰撞等逻辑移入对应 System

---

## 附录：文件索引

| 文件 | 作用 |
|------|------|
| [ecs/core.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/core.ts) | ECS 核心：World, ComponentStore, SystemManager |
| [ecs/components.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/components.ts) | 全部组件类型定义与原型 |
| [ecs/systems/block.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/block.ts) | 方块系统 |
| [ecs/systems/particle.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/particle.ts) | 粒子系统 |
| [ecs/systems/explosion.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/explosion.ts) | 爆炸系统 |
| [ecs/systems/weapon.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/weapon.ts) | 武器升级与外观系统 |
| [ecs/systems/build.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/build.ts) | 建造撤销/重做系统 |
| [ecs/systems/physicsLab.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/physicsLab.ts) | 物理实验室系统 |
| [ecs/systems/roboticArm.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/roboticArm.ts) | 机械臂系统 |
| [ecs/systems/blueprint.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/blueprint.ts) | 蓝图存档系统 |
| [ecs/systems/audio.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/ecs/systems/audio.ts) | 音频效果配置系统 |
| [store/gameStore.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/store/gameStore.ts) | Zustand 状态管理（ECS 与 UI 的桥梁） |
| [components/GameScene.tsx](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Saturn/src/components/GameScene.tsx) | 游戏主场景（渲染与交互入口） |
