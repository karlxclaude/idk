// Muscle regions tracked by the engine, with default mass fractions of whole-body skeletal muscle mass.
// Fractions are approximate anatomical muscle-volume shares (lower body ~53%, Janssen 2000 reports ~55%),
// normalised to sum to 1 at character creation. [L] — used for initial distribution only.

export const MUSCLE_REGIONS = [
  'upperChest', 'midLowerChest',
  'frontDelts', 'sideDelts', 'rearDelts',
  'upperTraps', 'midTrapsRhomboids', 'lats',
  'biceps', 'brachialis', 'tricepsLong', 'tricepsLatMed',
  'forearms',
  'spinalErectors', 'rectusAbdominis', 'obliques',
  'gluteMax', 'gluteMed',
  'rectusFemoris', 'vasti', 'hamstrings', 'adductors',
  'gastrocnemius', 'soleus', 'tibialisAnterior',
  'neckFlexors', 'neckExtensors',
] as const;
export type MuscleId = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  upperChest: 'Upper chest', midLowerChest: 'Mid/lower chest',
  frontDelts: 'Front delts', sideDelts: 'Side delts', rearDelts: 'Rear delts',
  upperTraps: 'Upper traps', midTrapsRhomboids: 'Mid traps & rhomboids', lats: 'Lats',
  biceps: 'Biceps', brachialis: 'Brachialis & brachioradialis', tricepsLong: 'Triceps long head', tricepsLatMed: 'Triceps lateral/medial',
  forearms: 'Forearms (grip)',
  spinalErectors: 'Spinal erectors', rectusAbdominis: 'Rectus abdominis', obliques: 'Obliques',
  gluteMax: 'Glute max', gluteMed: 'Glute med',
  rectusFemoris: 'Rectus femoris', vasti: 'Vasti (quads)', hamstrings: 'Hamstrings', adductors: 'Adductors',
  gastrocnemius: 'Gastrocnemius', soleus: 'Soleus', tibialisAnterior: 'Tibialis anterior',
  neckFlexors: 'Neck flexors', neckExtensors: 'Neck extensors',
};

/** Default share of skeletal muscle mass per region (men). */
export const MUSCLE_MASS_FRACTIONS: Record<MuscleId, number> = {
  upperChest: 0.015, midLowerChest: 0.035,
  frontDelts: 0.012, sideDelts: 0.012, rearDelts: 0.008,
  upperTraps: 0.02, midTrapsRhomboids: 0.025, lats: 0.045,
  biceps: 0.02, brachialis: 0.012, tricepsLong: 0.018, tricepsLatMed: 0.022,
  forearms: 0.035,
  spinalErectors: 0.07, rectusAbdominis: 0.02, obliques: 0.03,
  gluteMax: 0.09, gluteMed: 0.03,
  rectusFemoris: 0.035, vasti: 0.13, hamstrings: 0.08, adductors: 0.075,
  gastrocnemius: 0.035, soleus: 0.04, tibialisAnterior: 0.015,
  neckFlexors: 0.008, neckExtensors: 0.012,
};

export const UPPER_BODY: ReadonlySet<MuscleId> = new Set<MuscleId>([
  'upperChest', 'midLowerChest', 'frontDelts', 'sideDelts', 'rearDelts', 'upperTraps', 'midTrapsRhomboids', 'lats',
  'biceps', 'brachialis', 'tricepsLong', 'tricepsLatMed', 'forearms', 'neckFlexors', 'neckExtensors',
]);
export const LOWER_BODY: ReadonlySet<MuscleId> = new Set<MuscleId>([
  'gluteMax', 'gluteMed', 'rectusFemoris', 'vasti', 'hamstrings', 'adductors', 'gastrocnemius', 'soleus', 'tibialisAnterior',
]);

/** Women carry relatively less upper-body muscle; applied before renormalisation. [M] */
export const FEMALE_UPPER_BODY_FACTOR = 0.85;

export const MOVEMENT_PATTERNS = [
  'squat', 'hinge', 'lunge', 'hipThrust', 'kneeExtension', 'kneeFlexion', 'adduction', 'abduction', 'calf', 'tibialis',
  'horizontalPress', 'verticalPress', 'horizontalPull', 'verticalPull', 'chestIsolation', 'shoulderIsolation', 'upperBackIsolation',
  'elbowFlexion', 'elbowExtension', 'grip', 'core', 'carry', 'neck',
  'olympic', 'ballistic', 'jump', 'sprint', 'sprintDrill', 'isometric', 'calisthenics', 'strongman', 'cardio',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Pattern similarity used for neural transfer between patterns (0-1). Symmetric; diagonal = 1. [HEUR] */
export const PATTERN_TRANSFER: Partial<Record<MovementPattern, Partial<Record<MovementPattern, number>>>> = {
  squat: { lunge: 0.5, hinge: 0.3, kneeExtension: 0.3, olympic: 0.4, jump: 0.3, strongman: 0.3 },
  hinge: { squat: 0.3, hipThrust: 0.4, kneeFlexion: 0.3, olympic: 0.4, strongman: 0.4, carry: 0.3 },
  lunge: { squat: 0.5, hipThrust: 0.2, sprint: 0.15 },
  hipThrust: { hinge: 0.4, lunge: 0.2, sprint: 0.1 },
  horizontalPress: { verticalPress: 0.4, elbowExtension: 0.3, chestIsolation: 0.3, calisthenics: 0.2 },
  verticalPress: { horizontalPress: 0.4, elbowExtension: 0.2, shoulderIsolation: 0.2, olympic: 0.2, strongman: 0.3 },
  horizontalPull: { verticalPull: 0.4, elbowFlexion: 0.3, upperBackIsolation: 0.3 },
  verticalPull: { horizontalPull: 0.4, elbowFlexion: 0.3, calisthenics: 0.4 },
  elbowFlexion: { horizontalPull: 0.2, verticalPull: 0.2 },
  elbowExtension: { horizontalPress: 0.3, verticalPress: 0.2 },
  olympic: { squat: 0.4, hinge: 0.4, ballistic: 0.5, jump: 0.3 },
  ballistic: { olympic: 0.5, jump: 0.5 },
  jump: { ballistic: 0.5, sprint: 0.3, squat: 0.3 },
  sprint: { jump: 0.3, sprintDrill: 0.5, lunge: 0.15 },
  sprintDrill: { sprint: 0.5 },
  carry: { hinge: 0.3, grip: 0.4, strongman: 0.5 },
  strongman: { hinge: 0.4, squat: 0.3, carry: 0.5, verticalPress: 0.3 },
  calisthenics: { verticalPull: 0.4, horizontalPress: 0.2, core: 0.3 },
  core: { calisthenics: 0.3 },
  grip: { carry: 0.4 },
};

export function patternTransfer(a: MovementPattern, b: MovementPattern): number {
  if (a === b) return 1;
  return PATTERN_TRANSFER[a]?.[b] ?? PATTERN_TRANSFER[b]?.[a] ?? 0;
}

/**
 * Fast-twitch (type II) fraction of each region relative to the vastus lateralis value. [L]
 * Soleus is predominantly type I; triceps and gastrocnemius are faster. Johnson et al. 1973-style autopsy data
 * show large between-muscle differences; values here are approximate.
 */
export const MUSCLE_FIBER_FACTOR: Record<MuscleId, number> = {
  upperChest: 1.05, midLowerChest: 1.05, frontDelts: 0.95, sideDelts: 0.95, rearDelts: 0.95,
  upperTraps: 0.9, midTrapsRhomboids: 0.9, lats: 1.0, biceps: 1.05, brachialis: 1.0, tricepsLong: 1.2, tricepsLatMed: 1.15,
  forearms: 1.0, spinalErectors: 0.8, rectusAbdominis: 0.9, obliques: 0.9, gluteMax: 1.0, gluteMed: 0.9,
  rectusFemoris: 1.05, vasti: 1.0, hamstrings: 1.05, adductors: 0.95, gastrocnemius: 1.0, soleus: 0.35, tibialisAnterior: 0.6,
  neckFlexors: 0.9, neckExtensors: 0.9,
};

/** Headroom class: how much a region grows relative to its untrained size. See hypertrophy.regionHeadroom*. */
export const MUSCLE_HEADROOM_CLASS: Record<MuscleId, 'upper' | 'legs' | 'calves' | 'core'> = {
  upperChest: 'upper', midLowerChest: 'upper', frontDelts: 'upper', sideDelts: 'upper', rearDelts: 'upper',
  upperTraps: 'upper', midTrapsRhomboids: 'upper', lats: 'upper', biceps: 'upper', brachialis: 'upper', tricepsLong: 'upper', tricepsLatMed: 'upper',
  forearms: 'upper', spinalErectors: 'core', rectusAbdominis: 'core', obliques: 'core', gluteMax: 'legs', gluteMed: 'legs',
  rectusFemoris: 'legs', vasti: 'legs', hamstrings: 'legs', adductors: 'legs', gastrocnemius: 'calves', soleus: 'calves', tibialisAnterior: 'calves',
  neckFlexors: 'upper', neckExtensors: 'upper',
};

/** Leg extensor regions that contribute to ballistic lower-body force (jump/sprint F0), with weights. */
export const LEG_EXTENSOR_WEIGHTS: Partial<Record<MuscleId, number>> = {
  vasti: 1, rectusFemoris: 0.4, gluteMax: 1, hamstrings: 0.5, adductors: 0.3, gastrocnemius: 0.6, soleus: 0.5,
};
