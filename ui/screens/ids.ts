// Screen ids (kept separate from the lazy registry so the store can import the type without loading screens).
export const SCREEN_IDS = ['newGame', 'dashboard', 'why', 'body', 'program', 'plan', 'testing', 'goals', 'minigame', 'saves', 'settings'] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];
