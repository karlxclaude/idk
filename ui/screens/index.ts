// Screen registry. Each screen is a lazy default-export component (no props) in ui/screens/<Name>.tsx.
// To fill a screen, replace its file; keep the default export and the registry entry stays valid.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ScreenId } from './ids';

export { SCREEN_IDS, type ScreenId } from './ids';

export interface ScreenDef {
  id: ScreenId;
  /** Nav label. */
  label: string;
  /** One-character nav glyph. */
  icon: string;
  /** False: usable with no active game (newGame, saves, settings). */
  requiresGame: boolean;
  /** Shown in the nav. `minigame` is nav-hidden unless a shift is pending. */
  nav: boolean;
  component: LazyExoticComponent<ComponentType>;
}

export const SCREENS: readonly ScreenDef[] = [
  { id: 'newGame', label: 'New game', icon: '+', requiresGame: false, nav: true, component: lazy(() => import('./NewGame')) },
  { id: 'dashboard', label: 'Dashboard', icon: '▦', requiresGame: true, nav: true, component: lazy(() => import('./Dashboard')) },
  { id: 'why', label: 'Why?', icon: '?', requiresGame: true, nav: true, component: lazy(() => import('./Why')) },
  { id: 'body', label: 'Body', icon: '⚉', requiresGame: true, nav: true, component: lazy(() => import('./Body')) },
  { id: 'program', label: 'Program', icon: '☰', requiresGame: true, nav: true, component: lazy(() => import('./Program')) },
  { id: 'plan', label: 'Life plan', icon: '☷', requiresGame: true, nav: true, component: lazy(() => import('./Plan')) },
  { id: 'testing', label: 'Testing', icon: '✓', requiresGame: true, nav: true, component: lazy(() => import('./Testing')) },
  { id: 'goals', label: 'Goals', icon: '⚑', requiresGame: true, nav: true, component: lazy(() => import('./Goals')) },
  { id: 'minigame', label: 'Shift', icon: '▶', requiresGame: true, nav: false, component: lazy(() => import('./MiniGame')) },
  { id: 'saves', label: 'Saves', icon: '↓', requiresGame: false, nav: true, component: lazy(() => import('./Saves')) },
  { id: 'settings', label: 'Settings', icon: '⚙', requiresGame: false, nav: true, component: lazy(() => import('./Settings')) },
];

export const SCREEN_BY_ID: Readonly<Record<ScreenId, ScreenDef>> = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;
