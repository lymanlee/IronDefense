/**
 * ObjectPool.ts - 对象池基类
 * 用于子弹和敌人的高效复用，避免频繁 instantiate/destroy
 */

import { Node, Prefab, instantiate, Component } from 'cc';

export class ObjectPool<T extends Component> {
  private _pool: Node[] = [];
  private _active: Node[] = [];
  private _prefab: Prefab;
  private _componentClass: new () => T;

  constructor(prefab: Prefab, initialSize: number = 10, componentClass: new () => T) {
    this._prefab = prefab;
    this._componentClass = componentClass;
    // 预热对象池
    for (let i = 0; i < initialSize; i++) {
      this._pool.push(this._createNew());
    }
  }

  private _createNew(): Node {
    const node = instantiate(this._prefab);
    node.active = false;
    return node;
  }

  /**
   * 获取对象，返回组件实例
   */
  get(): T | null {
    let node: Node;
    if (this._pool.length > 0) {
      node = this._pool.pop()!;
    } else {
      node = this._createNew();
    }
    node.active = true;
    this._active.push(node);
    return node.getComponent(this._componentClass);
  }

  put(component: T): void {
    const node = component.node;
    node.active = false;
    // swap-and-pop: O(1) 移除，避免 indexOf + splice 的 O(n) 开销
    const idx = this._active.indexOf(node);
    if (idx !== -1) {
      const last = this._active.length - 1;
      if (idx !== last) {
        this._active[idx] = this._active[last];
      }
      this._active.pop();
    }
    this._pool.push(node);
  }

  putAll(): void {
    // O(n) 批量回收，避免 splice(0,1) 循环的 O(n²) 开销
    for (let i = 0; i < this._active.length; i++) {
      this._active[i].active = false;
      this._pool.push(this._active[i]);
    }
    this._active.length = 0;
  }

  get activeCount(): number {
    return this._active.length;
  }

  get inactiveCount(): number {
    return this._pool.length;
  }

  /**
   * 遍历所有活跃对象
   */
  forEach(callback: (node: Node, index: number) => void): void {
    for (let i = 0; i < this._active.length; i++) {
      callback(this._active[i], i);
    }
  }

  /**
   * 清理指定对象并重新放回池中
   */
  remove(component: T): void {
    this.put(component);
  }
}
