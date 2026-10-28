# PHENOTYPE UI shell

React 18 + Vite + Zustand + Dexie. `/engine` is pure; the UI only calls it through `ui/store.ts`.

## Layout
- `main.tsx` mounts `App.tsx` (top bar with date/cash/fast-forward/auto-play/settings, nav, main area). In dev the store is on `window.__phenotype`.
- `store.ts` the single Zustand store. `saves.ts` Dexie DB `phenotype` (autosave slot every 7 days, JSON export/import). `units.ts` formatters (engine is metric). `theme.css` all styling (CSS variables, light/dark, `.grid`, `.card`, tables). `components/` small typed building blocks. `screens/` the registry + one file per screen.

## Reading the store
```tsx
const game = useGame();            // GameState | null (mutated in place by the engine)
const version = useVersion();      // bumped on every publish: use it as the dependency for useMemo/useEffect
const units = useUnits();          // 'kg' | 'lb'
const ctx = useCtx();              // cached SimContext for the game's mode (never build your own)
const { advance, updatePlan, buyLabTest, setScreen } = useActions();
const rows = useMemo(() => game?.history.slice(-90) ?? [], [game, version]);
```
The engine mutates `GameState` in place, so nested objects keep their identity; the store publishes a new top-level copy and bumps `version`. Never mutate `game` from a screen: call an action. Actions that can fail (`updatePlan`, `buy*`) return `{ ok, value | error }` instead of throwing.

## Screen contract
Each screen is `ui/screens/<Name>.tsx` with a **default export of a prop-less component**, registered lazily in `screens/index.ts` (`SCREENS`, `SCREEN_BY_ID`). Navigate with `setScreen(id)`. Screens with `requiresGame: true` are unreachable with no game (App shows `newGame`). To replace a placeholder just rewrite its file; do not rename the file or the default export.

## Conventions
- Display through `units.ts` (`fmtMass`, `fmtLoad`, `fmtMoney`, `fmtPct`, `fmtDate`, `fmtTime`); store/compute in metric.
- Use `components/` + the CSS classes (`card`, `grid`, `row`, `muted`, `primary`, `danger`); use theme variables (`var(--accent)`, ...), never hard-coded colors, so dark/light both work.
- Mobile first: no horizontal page scroll at 360 px (wrap tables in `.table-wrap`, charts in `ResponsiveContainer`). Bottom tab bar appears at <= 640 px.
- Only add your own files in `ui/screens` (and `ui/components` if truly shared). Do not edit `store.ts`/`App.tsx` without coordination; request new actions instead.
- Time passes only via `advance(n)`. It pauses with `pendingShift` (and switches to the `minigame` screen) when the job was never played; `completeShift(perf)` records the play, simulates that day and continues the rest of the advance. Auto-play and multi-day advances stop after an injury or notable event (`notice` in the top bar).
- Settings: `accelerated` only seeds NEW games (a game keeps its own mode in `game.settings.accelerated`); `units` is mirrored into the running game.
- "This is a game, not medical or nutrition advice." stays on the settings screen.
