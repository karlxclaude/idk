/**
 * Uniform-grid spatial hash broadphase. Rebuilt every sim step (cheap for a few hundred
 * circles). Items are inserted into every cell their bounding circle overlaps.
 */
export interface Circle {
  x: number;
  y: number;
  radius: number;
  /** Scratch stamp used for de-duplication during queries. */
  _qstamp: number;
}

export class SpatialHash<T extends Circle> {
  private cells = new Map<number, T[]>();
  private used: T[][] = [];
  private spare: T[][] = [];
  private stamp = 1;
  constructor(public cellSize = 64) {}

  private key(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  clear(): void {
    for (const arr of this.used) {
      arr.length = 0;
      this.spare.push(arr);
    }
    this.used.length = 0;
    this.cells.clear();
  }

  insert(item: T): void {
    const cs = this.cellSize;
    const x0 = Math.floor((item.x - item.radius) / cs), x1 = Math.floor((item.x + item.radius) / cs);
    const y0 = Math.floor((item.y - item.radius) / cs), y1 = Math.floor((item.y + item.radius) / cs);
    // Guard against giant items flooding the grid.
    if ((x1 - x0) * (y1 - y0) > 256) {
      this.insertCell(Math.floor(item.x / cs), Math.floor(item.y / cs), item);
      return;
    }
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) this.insertCell(cx, cy, item);
  }

  private insertCell(cx: number, cy: number, item: T) {
    const k = this.key(cx, cy);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = this.spare.pop() ?? [];
      this.cells.set(k, arr);
      this.used.push(arr);
    }
    arr.push(item);
  }

  /** Collect unique items whose cells overlap the query circle into `out` (broadphase only). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const s = ++this.stamp;
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (const it of arr) {
          if (it._qstamp === s) continue;
          it._qstamp = s;
          out.push(it);
        }
      }
    return out;
  }
}
