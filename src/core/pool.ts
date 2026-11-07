/** Generic object pool. Use for anything allocated per-frame or per-eat. */
export class Pool<T> {
  private free: T[] = [];
  constructor(
    private readonly factory: () => T,
    private readonly onRelease?: (item: T) => void,
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }
  acquire(): T {
    return this.free.pop() ?? this.factory();
  }
  release(item: T): void {
    this.onRelease?.(item);
    this.free.push(item);
  }
  get size(): number {
    return this.free.length;
  }
  drain(fn?: (item: T) => void): void {
    if (fn) this.free.forEach(fn);
    this.free.length = 0;
  }
}
