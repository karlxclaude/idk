/**
 * Generic id-keyed registry fed by Vite `import.meta.glob` (eager). Content agents add a NEW
 * FILE to the relevant folder - no shared registry file needs editing, so parallel work never
 * conflicts. Each globbed module should `export default` either one definition or an array.
 */
export interface HasId {
  id: string;
}

export class Registry<T extends HasId> {
  private map = new Map<string, T>();
  constructor(public readonly kind: string) {}

  register(def: T, source = 'manual'): void {
    if (!def || typeof def.id !== 'string') {
      console.warn(`[${this.kind}] ignoring invalid definition from ${source}`, def);
      return;
    }
    if (this.map.has(def.id)) console.warn(`[${this.kind}] duplicate id '${def.id}' from ${source} (overriding)`);
    this.map.set(def.id, def);
  }

  /** Register every default export (single def or array) of a glob result. */
  addModules(mods: Record<string, unknown>): void {
    for (const [path, mod] of Object.entries(mods)) {
      const d = (mod as { default?: unknown }).default;
      if (d === undefined) continue; // helper module without default export
      const list = Array.isArray(d) ? d : [d];
      for (const def of list) this.register(def as T, path);
    }
  }

  get(id: string): T | undefined {
    return this.map.get(id);
  }
  require(id: string): T {
    const d = this.map.get(id);
    if (!d) throw new Error(`[${this.kind}] unknown id '${id}'`);
    return d;
  }
  has(id: string) {
    return this.map.has(id);
  }
  all(): T[] {
    return [...this.map.values()];
  }
  ids(): string[] {
    return [...this.map.keys()];
  }
}
