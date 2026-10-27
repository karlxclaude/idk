// Force-velocity, jump and sprint constants (spec 5.3).
import { curve, design, k } from './define';

export const powerDefs = {
  /** Reference lower-body F0 (N/kg) for an untrained adult male with relative squat ~0.9x BW. */
  f0RefLower: k(27, 'N/kg', [22, 32], 'M', ['samozino2008', 'samozino2012'], true, 'Typical untrained-recreational F0 25-30 N/kg; elite 40-45.'),
  /** Reference lower-body V0 (m/s). */
  v0RefLower: k(3.0, 'm/s', [2.4, 3.6], 'M', ['samozino2012'], true, 'Typical V0 2.5-3.5 m/s.'),
  /** Exponent mapping relative lower-body strength (vs reference) to F0. */
  f0StrengthExponent: design(0.6, 'exponent', [0.4, 0.8], 'A 2x BW squatter reaches ~43 N/kg.'),
  /** V0 change per +0.1 type-II fraction above 0.5. */
  v0FiberPerTenth: k(0.05, 'm/s', [0.0, 0.1], 'L', ['costill1976'], false, 'Fast-twitch dominant: higher velocity capacity.'),
  /** Max trainable increase in V0 from velocity-specific (ballistic/plyo) work (fraction). */
  v0TrainableMax: k(0.15, 'ratio', [0.08, 0.25], 'M', ['cormie2010', 'cormie2011'], true, 'Ballistic training shifts the F-v profile toward velocity.'),
  /** Days to reach ~63% of V0 adaptation under full ballistic stimulus. */
  v0TauDays: design(45, 'days', [25, 80], 'Velocity adaptations are fairly quick.'),
  /** Countermovement bonus at baseline SSC quality (fraction of SJ height). */
  cmjBonusBase: k(0.1, 'ratio', [0.05, 0.15], 'M', ['markovic2007', 'samozino2008'], true, 'CMJ > SJ by ~10%.'),
  /** Additional CMJ bonus at full trained SSC quality. */
  cmjBonusTrainable: k(0.07, 'ratio', [0.03, 0.12], 'M', ['markovic2007'], true, 'Plyometrics: CMJ +8.7%, SJ +4.7%; the difference is SSC-specific.'),
  /** SSC quality time constant (days) under full plyometric stimulus. */
  sscTauDays: design(40, 'days', [20, 70], 'Reaches ~85% of max in 8-12 weeks of plyometrics.'),
  /** Arm-swing bonus to jump height. */
  armSwingBonus: k(0.1, 'ratio', [0.06, 0.15], 'M', ['markovic2007'], true, 'CMJA ~10% above CMJ.'),
  /** Push-off distance as fraction of leg length (standing hip height) at a typical squat depth. */
  pushOffFractionOfLeg: k(0.42, 'ratio', [0.35, 0.5], 'M', ['samozino2008'], true, 'hPO ~0.35-0.45 m for 0.9 m legs.'),
  /** Jump: fraction of total lower-body F0 produced from a static (non-countermovement) start. */
  gravity: k(9.81, 'm/s2', [9.81, 9.81], 'H', ['samozino2008'], true, 'Standard gravity.'),
  /** Sprint: reference horizontal F0 (N/kg) for an untrained male. */
  f0hRef: k(6.0, 'N/kg', [5, 7.5], 'M', ['samozino2016', 'morin2011'], true, 'Team-sport athletes 6-10 N/kg; untrained a bit lower.'),
  /** Sprint: reference vmax (m/s) for an untrained male. */
  vmaxRef: k(7.6, 'm/s', [6.8, 8.4], 'M', ['samozino2016', 'weyand2000'], true, 'Team sport 8-9.5; elite 11-12.4; untrained ~7.5.'),
  /** Exponent of vmax on lower-body F0 (ground force per mass). */
  vmaxStrengthExponent: k(0.35, 'exponent', [0.2, 0.5], 'L', ['weyand2000', 'seitz2014'], true, 'Large squat gains map to ~1-3% faster sprints.'),
  /** Max trainable vmax gain from max-velocity sprinting (fraction). */
  vmaxTrainableMax: k(0.12, 'ratio', [0.06, 0.2], 'M', ['samozino2016'], false, 'Max-velocity sprinting is the most specific vmax stimulus.'),
  vmaxTauDays: design(60, 'days', [30, 120], 'Sprint-specific adaptation time constant.'),
  /** Sprint technique (ratio of forces) at untrained start, and max. */
  rfStart: k(0.5, 'ratio', [0.3, 0.7], 'M', ['morin2011'], true, 'Technique index 0-1 mapping to RFmax/Drf.'),
  rfTrainableMax: design(1.0, 'ratio', [0.8, 1.0], 'Full technique.'),
  rfTauSessions: design(25, 'sessions', [12, 50], 'Sprint drills and practice improve technique.'),
  /** Effect of technique on F0h: F0h *= 1 + rfF0hGain * (rf - rfStart). */
  rfF0hGain: k(0.35, 'ratio', [0.2, 0.6], 'M', ['morin2011'], true, 'Technical ability predicts acceleration better than total force.'),
  /** Exponent of F0h on relative lower-body strength. */
  f0hStrengthExponent: design(0.5, 'exponent', [0.3, 0.7], 'Strength contributes to horizontal force with diminishing returns.'),
  /** Fraction of power stimulus directed to F0h by heavy sled work. */
  sledF0hBias: k(0.8, 'ratio', [0.5, 1.0], 'L', ['morin2017', 'cross2017sled'], true, 'Very heavy sleds mainly raise F0h.'),
  /** Fat-mass effect: jump/sprint use total body mass, so this is emergent; constant kept for sanity test tolerance. */
  bodyMassExponentSprint: k(1.0, 'exponent', [1.0, 1.0], 'H', ['samozino2016'], true, 'Relative force uses total mass by definition.'),
  /** Interference multiplier for power at high endurance volume. */
  interferencePower: k(0.25, 'ratio', [0.1, 0.4], 'M', ['wilson2012', 'schumann2022'], true, 'Power is blunted most (ES 0.91->0.55; SMD -0.28).'),
  /** Fraction of power stimulus attributed to RFD/reactive strength quality. */
  rfdTauDays: design(35, 'days', [20, 60], 'Rate of force development adapts quickly.'),
  /** Max RFD factor increase (fraction). */
  rfdTrainableMax: design(0.2, 'ratio', [0.1, 0.3], 'RFD/early force improves power output in short pushes.'),
  /** Strength level above which power training works slightly better (relative squat, x BW). */
  powerStrongThreshold: k(1.7, 'xBW', [1.4, 2.0], 'L', ['cormie2010'], true, 'Tendency only (n.s.) for stronger subjects to gain more jump height.'),
  powerStrongBonus: k(0.15, 'ratio', [0.0, 0.3], 'L', ['cormie2010'], true, 'Downgraded from M: effect was not significant.'),
} as const;

export const powerCurves = {
  /** Transfer of relative lower-body strength (xBW squat) to sprint/jump force: saturating. */
  relStrengthTransfer: curve('power.relStrengthTransfer', 'xBW', 'ratio',
    [[0.5, 0.75, 0.6, 0.85], [1.0, 1.0, 1.0, 1.0], [1.5, 1.18, 1.1, 1.25], [2.0, 1.3, 1.2, 1.4], [2.5, 1.36, 1.25, 1.5], [3.0, 1.4, 1.28, 1.55]],
    'L', ['suchomel2016', 'seitz2014'], true, 'Diminishing transfer above ~2x BW.'),
} as const;
