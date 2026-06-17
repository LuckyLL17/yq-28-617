# 游戏 ECS 核心架构分析

## 一、架构总览

本项目采用 **ECS（Entity-Component-System）** 架构模式，将游戏逻辑解耦为三个核心层次：

| 层次 | 职责 | 对应文件 |
|------|------|----------|
| **Entity** | 唯一标识符，无行为无数据 | `src/ecs/core.ts` → `World` |
| **Component** | 纯数据容器，无逻辑 | `src/ecs/components.ts` |
| **System** | 纯逻辑处理，操作 Component 数据 | `src/ecs/systems/*.ts` |

ECS World 作为全局单例实例化于 `src/store/gameStore.ts` 中，通过 Zustand Store 桥接 React UI 与 ECS 数据层。

```
┌─────────────────────────────────────────────────────┐
│                   React UI Layer                     │
│  (GameScene, Block, WeaponSystem, BuildMode, ...)   │
└──────────────────────┬──────────────────────────────┘
                       │ 读写
┌──────────────────────▼──────────────────────────────┐
│              Zustand Store (gameStore)               │
│  - 持有 ecsWorld 单例                                │
│  - 调用 System 函数操作 ECS World                    │
│  - 通过 collectXxxFromWorld() 同步数据到 UI          │
└──────────────────────┬──────────────────────────────┘
                       │ 委托
┌──────────────────────▼──────────────────────────────┐
│                 ECS World (core.ts)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Entity 集合  │  │ ComponentStore│  │ SystemMgr  │ │
│  │ (Set<EntityId>)│ │ (Map<Type,   │  │ (有序执行) │ │
│  │              │  │  Map<Id,Comp>)│  │            │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 二、核心层实现

### 2.1 Entity（实体）

**文件**: `src/ecs/core.ts` → `World` 类

Entity 本质上是一个 `string` 类型的唯一 ID（`EntityId`），由 `World` 统一管理生命周期：

```typescript
type EntityId = string;
```

- **创建**: `world.createEntity(id?)` — 支持自定义 ID 或自动生成随机 ID
- **销毁**: `world.destroyEntity(id)` — 同时移除该实体所有 Component
- **查询存在**: `world.hasEntity(id)`

World 内部维护两个核心数据结构：
- `entities: Set<EntityId>` — 所有实体 ID 集合
- `entityComponents: Map<EntityId, Set<string>>` — 每个实体拥有的 Component 类型索引

### 2.2 Component（组件）

**文件**: `src/ecs/components.ts`

所有 Component 均实现 `IComponent` 接口，通过 `_type` 字段标识类型，是纯数据容器：

```typescript
interface IComponent {
  readonly _type: string;
}
```

#### 组件清单

| 组件 | 类型标识 | 数据字段 | 用途 |
|------|----------|----------|------|
| **TransformComponent** | `transform` | position, rotation, size (均为三元组) | 空间变换，几乎所有实体共用 |
| **HealthComponent** | `health` | health, maxHealth | 生命值，用于方块受击判定 |
| **MaterialComponent** | `material` | material (wood/glass/concrete) | 材质类型，决定颜色、密度、生命 |
| **SprayComponent** | `spray` | sprayTextureVersion | 喷漆纹理版本号，驱动渲染更新 |
| **VisualComponent** | `visual` | color, size, life, maxLife | 视觉表现，用于粒子和爆炸特效 |
| **VelocityComponent** | `velocity` | velocity (三元组) | 速度向量，用于粒子运动 |
| **ExplosionComponent** | `explosion` | radius | 爆炸半径 |
| **PhysicsBodyComponent** | `physicsBody` | mass, isStatic, radius?, height? | 物理刚体属性，用于物理实验室 |
| **LabConstraintComponent** | `labConstraint` | constraintType, bodyAId, bodyBId, pivot/axis/stiffness 等参数 | 物理约束（弹簧/铰链/绳索等） |
| **BlockTagComponent** | `blockTag` | (空) | 标记实体为"方块" |
| **ParticleTagComponent** | `particleTag` | (空) | 标记实体为"粒子" |
| **ExplosionTagComponent** | `explosionTag` | (空) | 标记实体为"爆炸" |
| **LabObjectTagComponent** | `labObjectTag` | (空) | 标记实体为"实验室物体" |

#### 原型（Archetype）

通过预定义的 Component 组合定义实体原型，用于批量查询：

| 原型名 | 组件组合 | 对应游戏对象 |
|--------|----------|-------------|
| `BLOCK_ARCHETYPE` | BlockTag + Transform + Health + Material + Spray | 建筑方块 |
| `PARTICLE_ARCHETYPE` | ParticleTag + Transform + Velocity + Visual | 粒子特效 |
| `EXPLOSION_ARCHETYPE` | ExplosionTag + Transform + Explosion + Visual | 爆炸效果 |
| `LAB_OBJECT_ARCHETYPE` | LabObjectTag + Transform + PhysicsBody + Visual | 物理实验对象 |

### 2.3 ComponentStore（组件存储）

**文件**: `src/ecs/core.ts` → `ComponentStore` 类

采用 **稀疏集** 思想的两级 Map 结构存储组件：

```
Map<ComponentType, Map<EntityId, IComponent>>
```

- 外层 Map 按 Component 类型分片
- 内层 Map 按 EntityId 索引具体组件实例

核心操作：
- `add(entityId, component)` — 添加/替换组件（immutable 更新）
- `remove(entityId, type)` — 移除单个组件
- `get<T>(entityId, type)` — 获取组件（带类型断言）
- `has(entityId, type)` — 判断组件是否存在
- `getAll<T>(type)` — 获取某类型所有组件（返回副本）
- `removeEntity(entityId)` — 移除实体所有组件
- `clear()` / `clearType(type)` — 批量清理

### 2.4 World（世界）

**文件**: `src/ecs/core.ts` → `World` 类

World 是 ECS 的顶层协调者，组合 Entity 管理与 ComponentStore：

核心 API：
- **实体管理**: `createEntity`, `destroyEntity`, `hasEntity`, `getEntityIds`
- **组件管理**: `addComponent`, `removeComponent`, `getComponent`, `hasComponent`
- **查询**: `query(...componentTypes)` — 返回同时拥有指定类型组件的所有实体 ID

`query` 方法是 ECS 数据驱动的核心：通过 `entityComponents` 索引快速过滤，而非遍历所有组件存储。

### 2.5 SystemManager（系统管理器）

**文件**: `src/ecs/core.ts` → `SystemManager` 类

```typescript
interface ISystem {
  readonly name: string;
  update: (world: World, dt: number) => void;
}
```

- `register(system)` — 注册系统，按注册顺序确定执行顺序
- `unregister(name)` — 注销系统
- `update(world, dt)` — 按注册顺序依次调用各系统的 update

> **注意**: 当前项目中 SystemManager 已定义但未被实际使用。系统逻辑以**函数式模块**的形式实现，由 Zustand Store 按需调用，而非通过 SystemManager 驱动帧循环。

---

## 三、系统层详解

### 3.1 BlockSystem（方块系统）

**文件**: `src/ecs/systems/block.ts`

**职责**: 管理建筑方块的完整生命周期，包括创建、销毁、伤害、位置/旋转更新、喷漆纹理。

**核心函数**:

| 函数 | 功能 | 操作的组件 |
|------|------|-----------|
| `addBlock(world, block)` | 创建方块实体，挂载 BlockTag + Transform + Health + Material + Spray | 全部5个 |
| `removeBlock(world, id)` | 销毁方块实体并清理喷漆 Canvas | - |
| `damageBlock(world, id, damage)` | 扣减生命值，归零则销毁 | Health |
| `updateBlockPosition(world, id, pos)` | 更新位置 | Transform |
| `updateBlockRotation(world, id, rot)` | 更新旋转 | Transform |
| `addSprayPoint(blockId, point, world)` | 在 Canvas 上绘制喷漆并递增版本号 | Spray |
| `collectBlocksFromWorld(world)` | 从 ECS World 收集所有方块数据为 Map | 全部5个 |

**特殊设计**: 喷漆系统使用模块级 `Map<string, HTMLCanvasElement>` 缓存 Canvas，与 ECS 数据分离，通过 `sprayTextureVersion` 驱动渲染层更新。

**交互关系**:
- 被 `BuildSystem` 调用（addBlock / removeBlock / updateBlockPosition / updateBlockRotation / clearBlockSprayData）
- 被 `BlueprintSystem` 调用（addBlock / clearBlockSprayData / collectBlocksFromWorld）
- 被 `gameStore` 直接调用（damageBlock / addSprayPoint / getBlockSprayCanvas 等）

### 3.2 ParticleSystem（粒子系统）

**文件**: `src/ecs/systems/particle.ts`

**职责**: 管理粒子特效实体的增删改查。

**核心函数**:

| 函数 | 功能 | 操作的组件 |
|------|------|-----------|
| `addParticle(world, particle)` | 创建粒子实体，挂载 ParticleTag + Transform + Velocity + Visual | 全部4个 |
| `removeParticle(world, id)` | 销毁粒子实体 | - |
| `updateParticle(world, id, data)` | 部分更新粒子的位置/速度/视觉属性 | Transform / Velocity / Visual |
| `collectParticlesFromWorld(world)` | 收集所有粒子数据 | 全部4个 |

**交互关系**:
- 被 `gameStore` 直接调用
- 粒子由 `GameScene` 中的爆炸/破坏事件生成

### 3.3 ExplosionSystem（爆炸系统）

**文件**: `src/ecs/systems/explosion.ts`

**职责**: 管理爆炸特效实体的增删改查。

**核心函数**:

| 函数 | 功能 | 操作的组件 |
|------|------|-----------|
| `addExplosion(world, explosion)` | 创建爆炸实体，挂载 ExplosionTag + Transform + Explosion + Visual | 全部4个 |
| `removeExplosion(world, id)` | 销毁爆炸实体 | - |
| `updateExplosion(world, id, data)` | 部分更新爆炸的位置/半径/生命 | Transform / Explosion / Visual |
| `collectExplosionsFromWorld(world)` | 收集所有爆炸数据 | 全部4个 |

**交互关系**:
- 被 `gameStore` 直接调用
- 爆炸由 `WeaponSystem`（UI组件）触发，在 `GameScene.handleExplosion` 中计算伤害并调用 `damageBlock`

### 3.4 WeaponSystem（武器系统）

**文件**: `src/ecs/systems/weapon.ts`

**职责**: 管理武器自定义配置（升级/外观），纯数据计算，不操作 ECS World。

**核心函数**:

| 函数 | 功能 |
|------|------|
| `upgradeWeapon(customizations, weapon, key)` | 升级武器属性（damage/speed/radius），不可超过 MAX_LEVEL=5 |
| `setWeaponAppearance(customizations, weapon, key, value)` | 设置武器外观（颜色/特效类型） |
| `getWeaponUpgrade(customizations, weapon, key)` | 获取当前升级等级 |
| `getWeaponUpgradeMultiplier(customizations, weapon, key)` | 获取升级倍率 |
| `resetWeaponCustomizations()` | 重置为默认配置 |

**升级倍率公式**:
- 伤害: `1 + (level - 1) * 0.4`
- 速度: `1 + (level - 1) * 0.25`
- 范围: `1 + (level - 1) * 0.3`

**交互关系**:
- 被 `gameStore` 调用，数据存储在 Zustand state 中
- 不直接操作 ECS World，而是通过倍率影响 UI 层的武器发射参数

### 3.5 AudioSystem（音频系统）

**文件**: `src/ecs/systems/audio.ts`

**职责**: 音频效果配置的合并更新，纯数据操作。

**核心函数**:

| 函数 | 功能 |
|------|------|
| `updateAudioEffectsConfig(current, partial)` | 合并更新音频效果配置 |

**配置项**: shakeIntensity / glowIntensity / collapseThreshold / enableCollapse / colorMode

**交互关系**:
- 被 `gameStore` 调用
- 音频分析数据由 `useAudioAnalyzer` Hook 采集，通过 `setAudioAnalysis` 写入 Store
- 效果配置影响渲染层（震动/发光/颜色模式）

### 3.6 BuildSystem（建造系统）

**文件**: `src/ecs/systems/build.ts`

**职责**: 管理建造模式的撤销/重做操作，清理建造状态。

**核心函数**:

| 函数 | 功能 |
|------|------|
| `pushUndoAction(undoStack, action)` | 压入操作记录，超过 MAX_UNDO_STEPS=50 截断，清空 redoStack |
| `applyUndo(world, undoStack, redoStack)` | 执行撤销：add→removeBlock, remove→addBlock, move/rotate→回退 Transform |
| `applyRedo(world, undoStack, redoStack)` | 执行重做：反向操作 |
| `clearBuildState(world)` | 清除所有方块实体和喷漆数据 |

**BuildAction 类型**:
- `add` — 添加方块
- `remove` — 删除方块
- `move` — 移动方块（记录 fromPosition / toPosition）
- `rotate` — 旋转方块（记录 fromRotation / toRotation）

**交互关系**:
- 调用 `BlockSystem` 的 addBlock / removeBlock / updateBlockPosition / updateBlockRotation / clearBlockSprayData
- 直接读取 ECS World 的 TransformComponent
- 被 `gameStore` 调用

### 3.7 PhysicsLabSystem（物理实验室系统）

**文件**: `src/ecs/systems/physicsLab.ts`

**职责**: 管理物理实验室中的物体和约束，支持弹簧/铰链/绳索等物理约束。

**核心函数**:

| 函数 | 功能 | 操作的组件 |
|------|------|-----------|
| `addLabObject(world, obj)` | 创建实验物体，挂载 LabObjectTag + Transform + PhysicsBody + Visual | 全部4个 |
| `removeLabObject(world, id)` | 销毁物体及关联约束 | - |
| `updateLabObjectPosition(world, id, pos)` | 更新位置 | Transform |
| `addLabConstraint(world, constraint)` | 创建约束实体，挂载 LabConstraint | LabConstraint |
| `removeLabConstraint(world, id)` | 销毁约束 | - |
| `resetPhysicsLab(world)` | 清除所有实验物体和约束 | - |
| `collectLabObjectsFromWorld(world)` | 收集实验物体数据 | 全部4个 |
| `collectLabConstraintsFromWorld(world)` | 收集约束数据 | LabConstraint |

**约束类型**: spring / rope / hinge / pulley / distance

**交互关系**:
- 被 `gameStore` 直接调用
- `removeLabObject` 会级联删除关联的约束实体（查询 bodyAId / bodyBId 匹配）
- 物理模拟由 `usePhysics` Hook 中的 CANNON.World 驱动，与 ECS 数据双向同步

### 3.8 RoboticArmSystem（机械臂系统）

**文件**: `src/ecs/systems/roboticArm.ts`

**职责**: 管理机械臂关节状态，纯数据操作，不操作 ECS World。

**核心函数**:

| 函数 | 功能 |
|------|------|
| `setRoboticArmField(arm, key, value)` | 设置机械臂单个属性 |
| `resetRoboticArm()` | 重置为默认姿态 |

**状态字段**: baseAngle / shoulderAngle / elbowAngle / wristAngle / gripperOpen / isGrabbing / grabbedBlockId

**默认姿态**: baseAngle=0, shoulderAngle=-π/4, elbowAngle=π/2, wristAngle=0, gripperOpen=true

**交互关系**:
- 被 `gameStore` 调用，数据存储在 Zustand state 中
- 机械臂的物理模拟和渲染由 `RoboticArm` UI 组件处理
- `grabbedBlockId` 关联到 BlockSystem 管理的方块实体

### 3.9 BlueprintSystem（蓝图系统）

**文件**: `src/ecs/systems/blueprint.ts`

**职责**: 建筑蓝图的持久化存储（localStorage）和加载/保存/删除。

**核心函数**:

| 函数 | 功能 |
|------|------|
| `loadBlueprintsFromStorage()` | 从 localStorage 读取蓝图列表 |
| `saveBlueprintsToStorage(blueprints)` | 写入 localStorage |
| `saveBlueprint(world, name, existingBlueprints, gravityDirection)` | 从当前 World 收集方块并保存为蓝图 |
| `loadBlueprint(world, blueprint)` | 清空当前方块，按蓝图重建 |
| `deleteBlueprint(id, existingBlueprints)` | 删除指定蓝图 |

**交互关系**:
- 调用 `BlockSystem` 的 addBlock / clearBlockSprayData / collectBlocksFromWorld
- 直接查询 ECS World 的 BlockTag 实体
- 被 `gameStore` 调用

---

## 四、系统间交互关系图

```
                    ┌──────────────┐
                    │  gameStore   │ (Zustand)
                    │  (调度中心)   │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ BlockSystem │ │ParticleSys  │ │ExplosionSys │
    │  (方块CRUD) │ │ (粒子CRUD)  │ │ (爆炸CRUD)  │
    └──────┬──────┘ └─────────────┘ └─────────────┘
           │ ▲
           │ │ (调用 addBlock / removeBlock / collect)
           │ │
    ┌──────┴──────┐     ┌──────────────────┐
    │ BuildSystem │     │ BlueprintSystem  │
    │ (撤销/重做) │     │ (蓝图存取)       │
    └─────────────┘     └──────────────────┘

    ┌──────────────┐     ┌──────────────────┐
    │ WeaponSystem │     │  AudioSystem     │
    │ (武器配置)   │     │ (音频效果配置)   │
    │ [纯数据]     │     │ [纯数据]         │
    └──────────────┘     └──────────────────┘

    ┌──────────────────┐  ┌──────────────────┐
    │ PhysicsLabSystem │  │ RoboticArmSystem │
    │ (物理实验CRUD)   │  │ (机械臂状态)     │
    │                  │  │ [纯数据]         │
    └──────────────────┘  └──────────────────┘
```

### 交互分类

| 交互类型 | 说明 | 示例 |
|----------|------|------|
| **Store → System** | Store action 委托 System 函数操作 ECS World | `addBlock` → `BlockSystem.addBlock(ecsWorld, block)` |
| **System → World** | System 函数直接读写 World 的 Entity/Component | `damageBlock` 读取 HealthComponent 并更新 |
| **System → System** | 高层 System 调用底层 System 的函数 | `BuildSystem` → `BlockSystem.addBlock` |
| **World → Store** | 操作后通过 `collectXxxFromWorld()` 同步数据回 Store | `set({ blocks: collectBlocksFromWorld(ecsWorld) })` |
| **Store → Store** | 纯数据系统不操作 World，仅更新 Zustand state | `WeaponSystem.upgradeWeapon` 返回新 customizations |

---

## 五、数据流模式

### 5.1 写操作流（UI → ECS → UI）

```
用户操作 (点击/拖拽)
    │
    ▼
React 组件调用 gameStore action
    │
    ▼
gameStore action 调用 System 函数 (传入 ecsWorld)
    │
    ▼
System 函数操作 ecsWorld (addComponent / destroyEntity / ...)
    │
    ▼
gameStore 通过 collectXxxFromWorld(ecsWorld) 同步数据
    │
    ▼
Zustand set() 触发 React 重渲染
```

### 5.2 读操作流（ECS → UI）

```
React 组件订阅 gameStore state (useGameStore)
    │
    ▼
gameStore state 中的 blocks/particles/explosions Map
    │
    ▼
React 组件遍历 Map 渲染 3D 对象
```

### 5.3 帧循环流（物理模拟）

```
R3F useFrame
    │
    ▼
PhysicsStepper → usePhysics.step(delta)
    │
    ▼
CANNON.World.step() 推进物理模拟
    │
    ▼
物理体位置同步到 Three.js Mesh
```

---

## 六、设计特点与权衡

### 6.1 函数式 System 而非类式 System

当前实现中，System 以**纯函数模块**形式组织（每个文件导出一组函数），而非实现 `ISystem` 接口的类。`SystemManager` 虽已定义但未启用。

**优势**: 调用灵活，Store 可按需调用任意函数，无需统一的 update 循环
**代价**: 缺少自动化的帧循环驱动，系统执行顺序由调用方控制

### 6.2 Immutable Component 更新

组件更新采用展开运算符创建新对象替换旧对象：

```typescript
world.addComponent(id, { ...health, health: newHealth });
```

`addComponent` 内部直接覆盖同类型组件，实现 immutable 更新语义，配合 React 的引用比较触发重渲染。

### 6.3 Tag Component 模式

使用空数据的 Tag Component（BlockTag / ParticleTag / ExplosionTag / LabObjectTag）标记实体类别，配合 `world.query()` 实现高效的分类查询，避免遍历全部实体。

### 6.4 ECS 与物理引擎的双轨数据

CANNON 物理体的数据（位置/旋转）与 ECS TransformComponent 存在冗余：
- **建造/蓝图模式**: ECS TransformComponent 为数据源，物理体由其初始化
- **物理模拟模式**: CANNON.World 为数据源，物理步进后同步到 Three.js Mesh
- **爆炸伤害**: 直接从 gameStore.blocks（ECS 数据）计算距离，不依赖物理引擎

### 6.5 喷漆数据的模块级缓存

`BlockSystem` 使用模块级 `Map<string, HTMLCanvasElement>` 缓存喷漆 Canvas，与 ECS 数据分离。通过 `SprayComponent.sprayTextureVersion` 版本号机制通知渲染层更新纹理，避免每帧重建 Canvas。

---

## 七、游戏模式与系统映射

| 游戏模式 | 活跃系统 | 主要实体类型 |
|----------|----------|-------------|
| **destroy** (破坏) | BlockSystem, ParticleSystem, ExplosionSystem, WeaponSystem, AudioSystem | Block, Particle, Explosion |
| **build** (建造) | BlockSystem, BuildSystem, BlueprintSystem | Block |
| **roboticArm** (机械臂) | BlockSystem, RoboticArmSystem, ParticleSystem | Block |
| **physicsLab** (物理实验) | PhysicsLabSystem, ParticleSystem | LabObject, LabConstraint |
