# 游戏 ECS 核心架构详解

## 目录

- [1. ECS 架构概述](#1-ecs-架构概述)
- [2. 核心实现原理](#2-核心实现原理)
  - [2.1 实体 (Entity)](#21-实体-entity)
  - [2.2 组件 (Component)](#22-组件-component)
  - [2.3 系统 (System)](#23-系统-system)
  - [2.4 世界 (World)](#24-世界-world)
- [3. 组件定义与原型](#3-组件定义与原型)
  - [3.1 数据组件](#31-数据组件)
  - [3.2 标签组件](#32-标签组件)
  - [3.3 原型 (Archetype)](#33-原型-archetype)
- [4. 系统详解](#4-系统详解)
  - [4.1 BlockSystem - 方块系统](#41-blocksystem---方块系统)
  - [4.2 ParticleSystem - 粒子系统](#42-particlesystem---粒子系统)
  - [4.3 ExplosionSystem - 爆炸系统](#43-explosionsystem---爆炸系统)
  - [4.4 WeaponSystem - 武器系统](#44-weaponsystem---武器系统)
  - [4.5 BuildSystem - 建造系统](#45-buildsystem---建造系统)
  - [4.6 PhysicsLabSystem - 物理实验室系统](#46-physicslabsystem---物理实验室系统)
  - [4.7 BlueprintSystem - 蓝图系统](#47-blueprintsystem---蓝图系统)
  - [4.8 AudioSystem - 音频系统](#48-audiosystem---音频系统)
  - [4.9 RoboticArmSystem - 机械臂系统](#49-roboticarmsystem---机械臂系统)
- [5. 系统间交互与数据流](#5-系统间交互与数据流)
  - [5.1 整体数据流架构](#51-整体数据流架构)
  - [5.2 Zustand Store 与 ECS 的协作](#52-zustand-store-与-ecs-的协作)
  - [5.3 跨系统交互示例](#53-跨系统交互示例)
- [6. 物理引擎集成](#6-物理引擎集成)
- [7. 架构特点与设计模式](#7-架构特点与设计模式)

---

## 1. ECS 架构概述

本游戏采用 **ECS (Entity-Component-System)** 架构模式，这是一种数据驱动的游戏架构设计，核心思想是**组合优于继承**。

**ECS 三大核心概念：**

| 概念 | 定义 | 职责 |
|------|------|------|
| **Entity (实体)** | 游戏对象的唯一标识符 | 仅作为 ID 存在，不包含任何数据或逻辑 |
| **Component (组件)** | 纯数据结构 | 存储实体的某一方面属性（位置、颜色、生命值等） |
| **System (系统)** | 逻辑处理单元 | 对具有特定组件组合的实体进行批量处理 |

### 项目 ECS 目录结构

```
src/ecs/
├── core.ts          # ECS 核心实现 (World, ComponentStore, SystemManager)
├── components.ts    # 所有组件类型定义与原型
├── index.ts         # 统一导出
└── systems/         # 各个业务系统
    ├── block.ts        # 方块系统
    ├── particle.ts     # 粒子系统
    ├── explosion.ts    # 爆炸系统
    ├── weapon.ts       # 武器系统
    ├── build.ts        # 建造系统
    ├── physicsLab.ts   # 物理实验室系统
    ├── blueprint.ts    # 蓝图系统
    ├── audio.ts        # 音频系统
    ├── roboticArm.ts   # 机械臂系统
    └── index.ts        # 系统导出
```

---

## 2. 核心实现原理

### 2.1 实体 (Entity)

实体在本项目中只是一个 `string` 类型的 ID，通过 [World.createEntity()](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L61-L66) 创建：

```typescript
export type EntityId = string;

// 创建实体
createEntity(id?: string): EntityId {
  const entityId = id ?? World.generateId();
  this.entities.add(entityId);
  this.entityComponents.set(entityId, new Set());
  return entityId;
}

// 销毁实体
destroyEntity(id: EntityId): void {
  this.entities.delete(id);
  this.entityComponents.delete(id);
  this._componentStore.removeEntity(id);
}
```

**特点：**
- 实体本身不包含任何数据，只是一个标识符
- 每个实体维护一个 `Set<string>` 记录其拥有的组件类型
- 支持自定义 ID 或自动生成随机 ID

### 2.2 组件 (Component)

组件是纯数据结构，实现 [IComponent](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L3-L5) 接口：

```typescript
export interface IComponent {
  readonly _type: string;  // 组件类型标识
}
```

#### ComponentStore - 组件存储

[ComponentStore](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L9-L54) 采用 **按类型存储** 的设计（类似 Archetype ECS 的简化版）：

```typescript
export class ComponentStore {
  // 外层 Map: 组件类型 -> 内层 Map: 实体ID -> 组件实例
  private stores: Map<string, Map<EntityId, IComponent>> = new Map();

  add<T extends IComponent>(entityId: EntityId, component: T): void {
    this.getStore(component._type).set(entityId, component);
  }

  get<T extends IComponent>(entityId: EntityId, type: string): T | undefined {
    return this.stores.get(type)?.get(entityId) as T | undefined;
  }

  getAll<T extends IComponent>(type: string): Map<EntityId, T> {
    const store = this.stores.get(type);
    if (!store) return new Map();
    return new Map(store) as Map<EntityId, T>;
  }
}
```

**设计优势：**
- 同类型组件连续存储，缓存友好
- 按类型查询效率高
- 添加/删除组件只需操作对应类型的 Map

### 2.3 系统 (System)

系统在本项目中是**纯函数集合**，而非传统 ECS 的类实例。每个系统模块导出一组操作 World 的函数。

[ISystem 接口](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L129-L132) 定义了标准系统接口（虽然实际系统更多使用函数式风格）：

```typescript
export type SystemUpdateFn = (world: World, dt: number) => void;

export interface ISystem {
  readonly name: string;
  update: SystemUpdateFn;
}
```

[SystemManager](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L134-L157) 负责系统注册和按顺序执行：

```typescript
export class SystemManager {
  private systems: Map<string, ISystem> = new Map();
  private executionOrder: string[] = [];

  register(system: ISystem): void {
    this.systems.set(system.name, system);
    this.executionOrder.push(system.name);
  }

  update(world: World, dt: number): void {
    this.executionOrder.forEach((name) => {
      this.systems.get(name)?.update(world, dt);
    });
  }
}
```

> **注意：** 本项目实际使用的是**函数式系统**而非注册式系统。各系统直接导出操作 World 的纯函数，由 Zustand Store 调用。

### 2.4 世界 (World)

[World](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L56-L125) 是 ECS 的核心容器，协调实体、组件和系统。

```typescript
export class World {
  private entities: Set<EntityId> = new Set();
  private _componentStore: ComponentStore = new ComponentStore();
  private entityComponents: Map<EntityId, Set<string>> = new Map();

  // 实体管理
  createEntity(id?: string): EntityId
  destroyEntity(id: EntityId): void

  // 组件管理
  addComponent<T extends IComponent>(entityId: EntityId, component: T): void
  removeComponent(entityId: EntityId, type: string): void
  getComponent<T extends IComponent>(entityId: EntityId, type: string): T | undefined
  hasComponent(entityId: EntityId, type: string): boolean

  // 实体查询 - 按组件类型筛选
  query(...componentTypes: string[]): EntityId[]
}
```

#### 查询机制 (Query)

[World.query()](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/core.ts#L93-L102) 是系统获取目标实体的核心方式：

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

**查询逻辑：** 遍历所有实体，检查是否拥有所有指定的组件类型。这是一种简化的实现，对于中小规模实体数量完全够用。

---

## 3. 组件定义与原型

所有组件定义在 [components.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/components.ts) 中。

### 3.1 数据组件

| 组件 | 类型标识 | 主要字段 | 用途 |
|------|----------|----------|------|
| TransformComponent | `transform` | position, rotation, size | 空间变换信息 |
| HealthComponent | `health` | health, maxHealth | 生命值 |
| MaterialComponent | `material` | material | 材质类型 |
| SprayComponent | `spray` | sprayTextureVersion | 喷漆纹理版本 |
| VisualComponent | `visual` | color, size, life, maxLife | 视觉外观与生命周期 |
| VelocityComponent | `velocity` | velocity | 速度向量 |
| ExplosionComponent | `explosion` | radius | 爆炸半径 |
| PhysicsBodyComponent | `physicsBody` | mass, isStatic, radius, height | 物理刚体属性 |
| LabConstraintComponent | `labConstraint` | constraintType, bodyAId, bodyBId, ... | 物理约束参数 |

### 3.2 标签组件

标签组件不携带数据，仅用于标记实体类别，方便查询筛选：

| 标签组件 | 类型标识 | 标记对象 |
|----------|----------|----------|
| BlockTagComponent | `blockTag` | 方块实体 |
| ParticleTagComponent | `particleTag` | 粒子实体 |
| ExplosionTagComponent | `explosionTag` | 爆炸实体 |
| LabObjectTagComponent | `labObjectTag` | 物理实验室物体 |

### 3.3 原型 (Archetype)

原型是预定义的组件组合，表示一类典型实体：

```typescript
// 方块原型
export const BLOCK_ARCHETYPE = [
  ComponentType.BlockTag,
  ComponentType.Transform,
  ComponentType.Health,
  ComponentType.Material,
  ComponentType.Spray,
] as const;

// 粒子原型
export const PARTICLE_ARCHETYPE = [
  ComponentType.ParticleTag,
  ComponentType.Transform,
  ComponentType.Velocity,
  ComponentType.Visual,
] as const;

// 爆炸原型
export const EXPLOSION_ARCHETYPE = [
  ComponentType.ExplosionTag,
  ComponentType.Transform,
  ComponentType.Explosion,
  ComponentType.Visual,
] as const;

// 物理实验室物体原型
export const LAB_OBJECT_ARCHETYPE = [
  ComponentType.LabObjectTag,
  ComponentType.Transform,
  ComponentType.PhysicsBody,
  ComponentType.Visual,
] as const;
```

---

## 4. 系统详解

### 4.1 BlockSystem - 方块系统

[block.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/block.ts)

**职责：** 管理可破坏方块的增删改查、伤害计算、喷漆效果

**核心函数：**

| 函数 | 功能 |
|------|------|
| `addBlock(world, block)` | 添加方块实体及所有组件 |
| `removeBlock(world, id)` | 移除方块实体及喷漆数据 |
| `damageBlock(world, id, damage)` | 对方块造成伤害，返回是否被摧毁 |
| `updateBlockPosition(world, id, position)` | 更新方块位置 |
| `updateBlockRotation(world, id, rotation)` | 更新方块旋转 |
| `addSprayPoint(blockId, point, world)` | 添加喷漆点，更新纹理版本 |
| `collectBlocksFromWorld(world)` | 从世界收集所有方块数据 |
| `getBlockSprayCanvas(blockId)` | 获取方块喷漆 Canvas |

**设计特点：**
- 喷漆纹理使用独立的 `Map<string, HTMLCanvasElement>` 存储，不放在 ECS 组件中（因为 Canvas 是重量级资源且与渲染强相关）
- `sprayTextureVersion` 作为版本号触发 React 重新渲染
- 每个方块维护独立的 256x256 喷漆画布

### 4.2 ParticleSystem - 粒子系统

[particle.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/particle.ts)

**职责：** 管理粒子实体的生命周期和属性更新

**核心函数：**

| 函数 | 功能 |
|------|------|
| `addParticle(world, particle)` | 添加粒子实体 |
| `removeParticle(world, id)` | 移除粒子实体 |
| `updateParticle(world, id, data)` | 部分更新粒子属性 |
| `collectParticlesFromWorld(world)` | 收集所有粒子数据 |

**粒子组件构成：** `ParticleTag` + `Transform` + `Velocity` + `Visual`

### 4.3 ExplosionSystem - 爆炸系统

[explosion.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/explosion.ts)

**职责：** 管理爆炸效果实体

**核心函数：**

| 函数 | 功能 |
|------|------|
| `addExplosion(world, explosion)` | 添加爆炸实体 |
| `removeExplosion(world, id)` | 移除爆炸实体 |
| `updateExplosion(world, id, data)` | 更新爆炸属性 |
| `collectExplosionsFromWorld(world)` | 收集所有爆炸数据 |

**爆炸组件构成：** `ExplosionTag` + `Transform` + `Explosion` + `Visual`

### 4.4 WeaponSystem - 武器系统

[weapon.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/weapon.ts)

**职责：** 武器升级和外观定制管理（纯数据计算，不操作 ECS World）

**核心函数：**

| 函数 | 功能 |
|------|------|
| `upgradeWeapon(customizations, weapon, key)` | 升级武器属性 |
| `setWeaponAppearance(customizations, weapon, key, value)` | 设置武器外观 |
| `getWeaponUpgrade(customizations, weapon, key)` | 获取升级等级 |
| `getWeaponUpgradeMultiplier(customizations, weapon, key)` | 获取升级倍率 |
| `resetWeaponCustomizations()` | 重置武器定制 |

**设计特点：**
- 这是一个**纯计算系统**，不操作 ECS World
- 武器配置数据存储在 Zustand Store 中，不使用 ECS 实体
- 升级倍率通过函数 `UPGRADE_MULTIPLIERS[key](level)` 计算

### 4.5 BuildSystem - 建造系统

[build.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/build.ts)

**职责：** 建造模式的撤销/重做功能

**核心函数：**

| 函数 | 功能 |
|------|------|
| `pushUndoAction(undoStack, action)` | 推入撤销操作 |
| `applyUndo(world, undoStack, redoStack)` | 执行撤销 |
| `applyRedo(world, undoStack, redoStack)` | 执行重做 |
| `clearBuildState(world)` | 清空建造状态 |

**支持的操作类型：**
- `add` - 添加方块
- `remove` - 移除方块
- `move` - 移动方块
- `rotate` - 旋转方块

**设计特点：**
- 撤销/重做栈存储在 Zustand 中
- 执行撤销/重做时直接操作 ECS World 修改实体
- 最大撤销步数 `MAX_UNDO_STEPS = 50`

### 4.6 PhysicsLabSystem - 物理实验室系统

[physicsLab.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/physicsLab.ts)

**职责：** 管理物理实验室的物体和约束

**核心函数：**

| 函数 | 功能 |
|------|------|
| `addLabObject(world, obj)` | 添加物理实验物体 |
| `removeLabObject(world, id)` | 移除物理实验物体（级联移除关联约束） |
| `addLabConstraint(world, constraint)` | 添加物理约束 |
| `removeLabConstraint(world, id)` | 移除物理约束 |
| `resetPhysicsLab(world)` | 重置物理实验室 |
| `collectLabObjectsFromWorld(world)` | 收集所有实验物体 |
| `collectLabConstraintsFromWorld(world)` | 收集所有约束 |

**设计特点：**
- 删除物体时会自动删除关联的约束（级联删除）
- 约束也作为独立实体存在，使用 `LabConstraintComponent`
- 支持 5 种约束类型：spring, rope, hinge, pulley, distance

### 4.7 BlueprintSystem - 蓝图系统

[blueprint.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/blueprint.ts)

**职责：** 建筑蓝图的保存与加载（持久化到 localStorage）

**核心函数：**

| 函数 | 功能 |
|------|------|
| `saveBlueprint(world, name, blueprints, gravityDir)` | 保存当前场景为蓝图 |
| `loadBlueprint(world, blueprint)` | 加载蓝图表 |
| `deleteBlueprint(id, blueprints)` | 删除蓝图 |
| `loadBlueprintsFromStorage()` | 从 localStorage 加载 |
| `saveBlueprintsToStorage(blueprints)` | 保存到 localStorage |

**设计特点：**
- 蓝图数据持久化到 `localStorage`，键名为 `destruction-blueprints`
- 保存时调用 `collectBlocksFromWorld` 从 ECS 收集方块数据
- 加载时清空现有方块，批量创建新方块实体

### 4.8 AudioSystem - 音频系统

[audio.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/audio.ts)

**职责：** 音频效果配置管理

**核心函数：**

| 函数 | 功能 |
|------|------|
| `updateAudioEffectsConfig(current, partial)` | 更新音频效果配置 |

**设计特点：**
- 极简实现，仅提供配置合并函数
- 音频分析数据由 React 组件层处理，不进入 ECS

### 4.9 RoboticArmSystem - 机械臂系统

[roboticArm.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/ecs/systems/roboticArm.ts)

**职责：** 机械臂状态管理

**核心函数：**

| 函数 | 功能 |
|------|------|
| `setRoboticArmField(arm, key, value)` | 设置机械臂单个字段 |
| `resetRoboticArm()` | 重置机械臂到默认状态 |

**机械臂状态字段：**
- `baseAngle` - 基座角度
- `shoulderAngle` - 肩部角度
- `elbowAngle` - 肘部角度
- `wristAngle` - 腕部角度
- `gripperOpen` - 夹爪是否张开
- `isGrabbing` - 是否抓取中
- `grabbedBlockId` - 抓取的方块 ID

---

## 5. 系统间交互与数据流

### 5.1 整体数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                    React 组件层 (渲染)                       │
│  Block.tsx, Particles.tsx, WeaponSystem.tsx, GameScene.tsx  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 读取/订阅
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Zustand Store (状态管理层)                 │
│                   useGameStore (gameStore.ts)               │
│  - blocks Map                                               │
│  - particles Map                                            │
│  - explosions Map                                           │
│  - weaponCustomizations                                     │
│  - undoStack / redoStack                                    │
│  - ... 其他 UI 状态                                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ 调用
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ECS Systems (逻辑层)                      │
│  BlockSystem  ParticleSystem  ExplosionSystem  BuildSystem  │
│  PhysicsLabSystem  BlueprintSystem  WeaponSystem  ...       │
└──────────────────────────────┬──────────────────────────────┘
                               │ 读写
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ECS World (数据层)                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │ Entities │  │ ComponentStore│  │ entityComponents│      │
│  │ (ID Set) │  │ (按类型存储)  │  │ (实体->组件映射) │      │
│  └──────────┘  └──────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Zustand Store 与 ECS 的协作

[gameStore.ts](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/store/gameStore.ts) 是连接 ECS 与 React 的桥梁。

**典型的 Store action 模式：**

```typescript
// 以 addBlock 为例
addBlock: (block) => {
  // 1. 调用 ECS System 修改 World
  BlockSystem.addBlock(ecsWorld, block);
  // 2. 从 World 收集数据更新 Store（触发 React 重渲染）
  set({ blocks: BlockSystem.collectBlocksFromWorld(ecsWorld) });
},
```

**数据同步机制：**

1. **写入路径：** React 交互 → Store action → ECS System → World
2. **读取路径：** Store → collectFromWorld → React 组件订阅 → 渲染

**设计模式：** ECS World 是**唯一真相源**，Zustand Store 中的 `blocks`/`particles`/`explosions` 等 Map 只是 ECS 数据的**投影/缓存**，用于驱动 React 渲染。

### 5.3 跨系统交互示例

#### 示例 1：爆炸伤害方块 (Explosion → Block)

在 [GameScene.tsx](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/components/GameScene.tsx#L194-L259) 的 `handleExplosion` 中：

```
爆炸触发
  ↓
遍历所有方块 (blocks Map)
  ↓
计算距离 → 计算伤害
  ↓
调用 damageBlock(blockId, damage)
  ├→ BlockSystem.damageBlock(ecsWorld, id, damage)
  │   └→ 操作 ECS: 扣血/摧毁
  └→ 更新 Store blocks Map
       └→ 触发 React 重渲染
  ↓
若方块被摧毁 → 生成粒子 → 生成碎片
  ├→ addParticle(...) → ParticleSystem → ECS
  └→ spawnDebris(...) → DebrisSystem
```

#### 示例 2：撤销建造操作 (Build → Block)

```
用户点击撤销
  ↓
useGameStore.getState().undo()
  ↓
BuildSystem.applyUndo(ecsWorld, undoStack, redoStack)
  ├→ 根据 action.type 执行反向操作
  │   ├─ add → removeBlock
  │   ├─ remove → addBlock
  │   ├─ move → 恢复 fromPosition
  │   └─ rotate → 恢复 fromRotation
  └→ 操作 ECS World 修改实体
  ↓
collectBlocksFromWorld → 更新 Store
  ↓
React 重渲染
```

#### 示例 3：加载蓝图 (Blueprint → Block)

```
用户选择蓝图
  ↓
BlueprintSystem.loadBlueprint(ecsWorld, blueprint)
  ├→ 清空现有方块
  └→ 批量 addBlock 创建实体
  ↓
Store 更新 blocks + gravityDirection
  ↓
React 重渲染
```

---

## 6. 物理引擎集成

物理引擎使用 **cannon-es**，通过 [usePhysics](file:///Volumes/ExMac/traeProject/0617GSB/yq-28/yq-28-617_Jupiter/src/hooks/usePhysics.ts) Hook 集成。

### 物理与 ECS 的关系

```
┌─────────────────┐         ┌─────────────────┐
│   ECS World     │         │  CANNON World   │
│  (逻辑数据)     │         │  (物理模拟)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ 同步 Transform             │ 物理模拟 step
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────┐
│              React 渲染层                        │
│  Block 组件同时从 ECS 读位置 + 从物理引擎同步   │
└─────────────────────────────────────────────────┘
```

### 关键集成点

1. **双重 ID 映射：** ECS 实体 ID 与 CANNON Body 通过相同的 ID 关联，`bodiesMapRef` 维护 `id -> CANNON.Body` 映射

2. **爆炸物理冲量：** `applyExplosion()` 遍历所有物理刚体，计算冲量并应用

3. **重力方向切换：** 监听 `gravityDirection` 变化，同步更新 CANNON.World.gravity 并重建地面平面

4. **物理步进：** `PhysicsStepper` 组件通过 `useFrame` 每帧调用 `step(delta)`

---

## 7. 架构特点与设计模式

### 7.1 混合架构：ECS + 状态管理

本项目不是纯 ECS，而是 **ECS 数据驱动 + Zustand 状态管理** 的混合架构：

| 数据类型 | 存储位置 | 原因 |
|----------|----------|------|
| 方块、粒子、爆炸等游戏实体 | ECS World | 数量多，需要按组件查询，数据驱动 |
| 武器配置、UI 状态、撤销栈 | Zustand Store | 与 UI 强相关，数量少，需要响应式 |
| 物理刚体 | CANNON World | 专用物理引擎模拟 |
| 喷漆 Canvas | BlockSystem 内部 Map | 渲染资源，重量级，不适合 ECS 组件 |

### 7.2 函数式系统风格

不同于传统 ECS 的「系统类注册到 World，每帧统一 update」模式，本项目采用**函数式系统**：

- 每个系统是一组纯函数，接收 World 作为参数
- 由 Zustand Store 在需要时主动调用
- 没有固定的每帧 update 循环（物理循环由 useFrame 驱动）

**优势：**
- 更灵活，按需调用
- 与 React 状态管理结合自然
- 易于测试（纯函数）

### 7.3 数据一致性策略

- **ECS World 是唯一真相源**：所有修改先写入 ECS
- **Store 是只读投影**：通过 `collectFromWorld` 同步
- **每次修改后全量收集**：简单可靠，牺牲一定性能换取一致性

### 7.4 标签组件模式

使用无数据的 Tag 组件（`BlockTag`, `ParticleTag` 等）实现实体分类，查询时只需 `query(ComponentType.BlockTag)` 即可获取某类所有实体。

### 7.5 级联删除

删除父实体时自动删除关联子实体：
- 删除实验室物体 → 删除其关联的所有约束
- 删除方块 → 删除喷漆画布数据

---

## 总结

本项目的 ECS 架构是一个**轻量级、实用导向**的实现：

1. **核心精简**：150 行左右的 core.ts 实现了完整的 ECS 基础
2. **数据驱动**：方块、粒子、爆炸等动态对象使用 ECS 管理
3. **灵活集成**：与 Zustand、CANNON.js、React Three Fiber 无缝协作
4. **函数式系统**：系统以纯函数形式存在，按需调用而非固定循环
5. **务实取舍**：不追求纯 ECS，该用状态管理的地方用状态管理，该用专用引擎的地方用专用引擎

这种设计非常适合中小规模的 3D 沙盒/破坏类游戏，既利用了 ECS 数据驱动的优势，又避免了过度设计带来的复杂性。
