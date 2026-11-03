// Registry of job mini-games (one per job; see data/jobs.ts). Components are lazy-loaded for code splitting.
import type { MiniGameId } from '../data/jobs';
import type { MiniGameMeta } from './types';

export const MINIGAMES: Record<MiniGameId, MiniGameMeta> = {
  spatial_packing: { id: 'spatial_packing', name: 'Tote packing', instructions: 'Pack the order items into the tote; reject red items that are not on the order.', load: () => import('./spatial_packing/Game') },
  route_timing: { id: 'route_timing', name: 'Delivery run', instructions: 'Ride to the pickup, then the drop-off, before the deadline. Red lights cost time.', load: () => import('./route_timing/Game') },
  rhythm_timing: { id: 'rhythm_timing', name: 'Dinner rush', instructions: 'Hit D/F/J/K as each station cue crosses the line: early is undercooked, late is burnt.', load: () => import('./rhythm_timing/Game') },
  sorting: { id: 'sorting', name: 'Shelf stocking', instructions: 'Shelve each product on its shelf, older dates in front (Shift), expired items in the bin.', load: () => import('./sorting/Game') },
  typing_accuracy: { id: 'typing_accuracy', name: 'Invoice entry', instructions: 'Type each invoice field exactly; Enter moves to the next field.', load: () => import('./typing_accuracy/Game') },
  load_balance: { id: 'load_balance', name: 'Scaffold carry', instructions: 'Keep the stack balanced (Left/Right) while walking it across the beam.', load: () => import('./load_balance/Game') },
  client_programming: { id: 'client_programming', name: 'Client program', instructions: 'Read the client intake and build an 8-week plan; their results run on the same physiology engine.', load: () => import('./client_programming/Game') },
};
