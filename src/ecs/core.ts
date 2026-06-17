export type EntityId = string;

export interface IComponent {
  readonly _type: string;
}

export type ComponentConstructor<T extends IComponent> = new (...args: any[]) => T;

export class ComponentStore {
  private stores: Map<string, Map<EntityId, IComponent>> = new Map();

  private getStore(type: string): Map<EntityId, IComponent> {
    let store = this.stores.get(type);
    if (!store) {
      store = new Map();
      this.stores.set(type, store);
    }
    return store;
  }

  add<T extends IComponent>(entityId: EntityId, component: T): void {
    this.getStore(component._type).set(entityId, component);
  }

  remove(entityId: EntityId, type: string): void {
    this.stores.get(type)?.delete(entityId);
  }

  get<T extends IComponent>(entityId: EntityId, type: string): T | undefined {
    return this.stores.get(type)?.get(entityId) as T | undefined;
  }

  has(entityId: EntityId, type: string): boolean {
    return this.stores.get(type)?.has(entityId) ?? false;
  }

  getAll<T extends IComponent>(type: string): Map<EntityId, T> {
    const store = this.stores.get(type);
    if (!store) return new Map();
    return new Map(store) as Map<EntityId, T>;
  }

  removeEntity(entityId: EntityId): void {
    this.stores.forEach((store) => store.delete(entityId));
  }

  clear(): void {
    this.stores.clear();
  }

  clearType(type: string): void {
    this.stores.get(type)?.clear();
  }
}

export class World {
  private entities: Set<EntityId> = new Set();
  private _componentStore: ComponentStore = new ComponentStore();
  private entityComponents: Map<EntityId, Set<string>> = new Map();

  createEntity(id?: string): EntityId {
    const entityId = id ?? World.generateId();
    this.entities.add(entityId);
    this.entityComponents.set(entityId, new Set());
    return entityId;
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
    this.entityComponents.delete(id);
    this._componentStore.removeEntity(id);
  }

  addComponent<T extends IComponent>(entityId: EntityId, component: T): void {
    if (!this.entities.has(entityId)) return;
    this._componentStore.add(entityId, component);
    this.entityComponents.get(entityId)?.add(component._type);
  }

  removeComponent(entityId: EntityId, type: string): void {
    this._componentStore.remove(entityId, type);
    this.entityComponents.get(entityId)?.delete(type);
  }

  getComponent<T extends IComponent>(entityId: EntityId, type: string): T | undefined {
    return this._componentStore.get<T>(entityId, type);
  }

  hasComponent(entityId: EntityId, type: string): boolean {
    return this._componentStore.has(entityId, type);
  }

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

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  getEntityIds(): Set<EntityId> {
    return new Set(this.entities);
  }

  get componentStore(): ComponentStore {
    return this._componentStore;
  }

  clear(): void {
    this.entities.clear();
    this.entityComponents.clear();
    this._componentStore.clear();
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

export type SystemUpdateFn = (world: World, dt: number) => void;

export interface ISystem {
  readonly name: string;
  update: SystemUpdateFn;
}

export class SystemManager {
  private systems: Map<string, ISystem> = new Map();
  private executionOrder: string[] = [];

  register(system: ISystem): void {
    this.systems.set(system.name, system);
    this.executionOrder.push(system.name);
  }

  unregister(name: string): void {
    this.systems.delete(name);
    this.executionOrder = this.executionOrder.filter((n) => n !== name);
  }

  update(world: World, dt: number): void {
    this.executionOrder.forEach((name) => {
      this.systems.get(name)?.update(world, dt);
    });
  }

  get(name: string): ISystem | undefined {
    return this.systems.get(name);
  }
}
