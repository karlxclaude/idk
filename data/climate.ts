// New England (~42 N, Boston) seasonal climate used for sweat rates and vitamin D synthesis.
// Monthly mean temperatures approximate NOAA Boston normals; UVB factor is relative previtamin D3 synthesis
// potential at midday (zero Nov-Feb per Webb, Kline & Holick 1988). [L]
export const MONTHLY_TEMP_C: Record<number, number> = { 1: -2, 2: -1, 3: 3, 4: 9, 5: 15, 6: 20, 7: 24, 8: 23, 9: 18, 10: 12, 11: 6, 12: 1 };
export const MONTHLY_UVB_FACTOR: Record<number, number> = { 1: 0, 2: 0, 3: 0.15, 4: 0.45, 5: 0.8, 6: 1, 7: 1, 8: 0.85, 9: 0.55, 10: 0.2, 11: 0, 12: 0 };
