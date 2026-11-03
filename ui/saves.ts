// Local saves in IndexedDB (Dexie). One row per save; the state is stored as a JSON string.
import Dexie, { type Table } from 'dexie';
import { GAME_VERSION, type GameState } from '../engine/game';

export interface SaveRecord {
  id?: number;
  name: string;
  updatedAt: number;
  /** In-game day of the saved state. */
  day: number;
  /** JSON.stringify(GameState). */
  state: string;
}
export type SaveSummary = Omit<SaveRecord, 'state'> & { id: number };

export const AUTOSAVE_NAME = 'Autosave';
export const AUTOSAVE_EVERY_DAYS = 7;
const EXPORT_APP = 'phenotype';

class PhenotypeDB extends Dexie {
  saves!: Table<SaveRecord, number>;
  constructor() {
    super('phenotype');
    this.version(1).stores({ saves: '++id, name, updatedAt, day' });
  }
}

let db: PhenotypeDB | null = null;
export function getDb(): PhenotypeDB {
  return (db ??= new PhenotypeDB());
}

const summary = (r: SaveRecord): SaveSummary => ({ id: r.id as number, name: r.name, updatedAt: r.updatedAt, day: r.day });

/** All saves, newest first, without the state payload. */
export async function listSaves(): Promise<SaveSummary[]> {
  const rows = await getDb().saves.orderBy('updatedAt').reverse().toArray();
  return rows.map(summary);
}

/** Save under `name`; an existing save with the same name is overwritten. Returns its id. */
export async function saveGame(name: string, state: GameState): Promise<number> {
  const table = getDb().saves;
  const rec: SaveRecord = { name, updatedAt: Date.now(), day: state.character.day, state: JSON.stringify(state) };
  // One rw transaction: concurrent saves under the same name (e.g. autosave racing a manual save) never duplicate a row.
  return getDb().transaction('rw', table, async () => {
    const existing = await table.where('name').equals(name).first();
    if (existing?.id !== undefined) {
      await table.put({ ...rec, id: existing.id });
      return existing.id;
    }
    return table.add(rec);
  });
}

export async function loadSave(id: number): Promise<GameState | null> {
  const rec = await getDb().saves.get(id);
  return rec ? (JSON.parse(rec.state) as GameState) : null;
}

export async function deleteSave(id: number): Promise<void> {
  await getDb().saves.delete(id);
}

/** Write the single "Autosave" slot when >= 7 in-game days passed since it (or the game restarted earlier). Returns true if written. */
export async function autosave(state: GameState): Promise<boolean> {
  const day = state.character.day;
  const table = getDb().saves;
  const due = await getDb().transaction('rw', table, async () => {
    const existing = await table.where('name').equals(AUTOSAVE_NAME).first();
    if (existing && day >= existing.day && day - existing.day < AUTOSAVE_EVERY_DAYS) return false;
    const rec: SaveRecord = { name: AUTOSAVE_NAME, updatedAt: Date.now(), day, state: JSON.stringify(state) };
    await table.put(existing?.id !== undefined ? { ...rec, id: existing.id } : rec);
    return true;
  });
  return due;
}

/** Portable JSON text of a game (an envelope around the state). */
export function exportSave(state: GameState): string {
  return JSON.stringify({ app: EXPORT_APP, version: GAME_VERSION, exportedAt: new Date().toISOString(), state });
}

export function exportSaveBlob(state: GameState): Blob {
  return new Blob([exportSave(state)], { type: 'application/json' });
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parse and minimally validate an exported save (envelope or bare state). Throws Error with a readable message. */
export function importSave(json: string): GameState {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Not valid JSON'); }
  const st = isObj(raw) && isObj(raw.state) ? raw.state : raw;
  if (!isObj(st)) throw new Error('Not a PHENOTYPE save');
  if (typeof st.version !== 'number') throw new Error('Save has no version');
  if (st.version > GAME_VERSION) throw new Error(`Save is from a newer version (${st.version} > ${GAME_VERSION})`);
  const ch = st.character;
  if (!isObj(ch) || typeof ch.day !== 'number' || !isObj(ch.body) || !isObj(ch.genetics)) throw new Error('Save has no valid character');
  if (!isObj(st.plan) || !isObj(st.ledger) || !isObj(st.settings) || !isObj(st.pantry)) throw new Error('Save is missing plan, ledger, pantry or settings');
  if (!Array.isArray(st.history) || !Array.isArray(st.reports) || !Array.isArray(st.access)) throw new Error('Save is missing history');
  if (typeof st.seed !== 'string') throw new Error('Save has no seed');
  return st as unknown as GameState;
}
