// Full exercise library (Phase 2), one module per category under ./lib.
import type { Exercise } from './schema';
import { HPRESS_EXERCISES } from './lib/hpress';
import { VPRESS_EXERCISES } from './lib/vpress';
import { PULL_EXERCISES } from './lib/pull';
import { ARMS_EXERCISES } from './lib/arms';
import { SHOULDERS_EXERCISES } from './lib/shoulders';
import { SQUAT_EXERCISES } from './lib/squat';
import { HINGE_EXERCISES } from './lib/hinge';
import { LEG_ACCESSORY_EXERCISES } from './lib/legaccessory';
import { TRUNK_EXERCISES } from './lib/trunk';
import { GRIP_NECK_EXERCISES } from './lib/gripneck';
import { CALISTHENICS_EXERCISES } from './lib/calisthenics';
import { ISOMETRIC_EXERCISES } from './lib/isometric';
import { OLYMPIC_EXERCISES } from './lib/olympic';
import { PLYO_EXERCISES } from './lib/plyo';
import { SPRINT_EXERCISES } from './lib/sprint';
import { STRONGMAN_EXERCISES } from './lib/strongman';
import { CARDIO_EXERCISES } from './lib/cardio';

export const LIBRARY_EXERCISES: Exercise[] = [...HPRESS_EXERCISES, ...VPRESS_EXERCISES, ...PULL_EXERCISES, ...ARMS_EXERCISES, ...SHOULDERS_EXERCISES, ...SQUAT_EXERCISES, ...HINGE_EXERCISES, ...LEG_ACCESSORY_EXERCISES, ...TRUNK_EXERCISES, ...GRIP_NECK_EXERCISES, ...CALISTHENICS_EXERCISES, ...ISOMETRIC_EXERCISES, ...OLYMPIC_EXERCISES, ...PLYO_EXERCISES, ...SPRINT_EXERCISES, ...STRONGMAN_EXERCISES, ...CARDIO_EXERCISES];
