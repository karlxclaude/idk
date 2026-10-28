// Shared contract for job mini-games. Each game has a pure, seeded logic core (testable headless) and a
// React component that renders it (canvas or DOM). The result feeds engine/jobs.ts `resolveShift` as `performance`.
import type { MiniGameId } from '../data/jobs';

export interface MiniGameProps {
  /** Seed for deterministic level generation. */
  seed: string;
  /**
   * Difficulty multiplier 0..1 from engine/jobs.ts `miniGameDifficulty` (1 = rested, lower = sleep-deprived/stressed).
   * Lower values must make the game measurably harder (shorter windows, more noise, input lag), never easier.
   */
  difficulty: number;
  /** Called once with a performance score 0..1 when the shift ends. */
  onFinish: (performance: number) => void;
  /** Optional time limit override in seconds (tests/previews). */
  durationSec?: number;
}

export interface MiniGameMeta {
  id: MiniGameId;
  name: string;
  /** One-line instructions shown before play. */
  instructions: string;
  /** Lazy component loader so mini-games are code-split. */
  load: () => Promise<{ default: (p: MiniGameProps) => JSX.Element }>;
}
