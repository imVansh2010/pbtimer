import type { Solve } from "./types";

/** Solve time with penalty applied. DNF is Infinity so sorting works for free. */
export function effectiveMs(solve: Solve): number {
  if (solve.penalty === "dnf") return Infinity;
  return solve.ms + (solve.penalty === "plus2" ? 2000 : 0);
}

/**
 * Average of the newest `n` solves, using WCA trimming rules.
 * Returns null when there are not enough solves, Infinity for a DNF average.
 */
export function averageOf(solvesNewestFirst: Solve[], n: number): number | null {
  if (n < 3 || solvesNewestFirst.length < n) return null;
  const window = solvesNewestFirst.slice(0, n).map(effectiveMs);
  const dnfs = window.filter((value) => !Number.isFinite(value)).length;

  if (n === 3) {
    if (dnfs > 0) return Infinity;
    return window.reduce((a, b) => a + b, 0) / n;
  }

  if (dnfs > 1) return Infinity;
  const sorted = [...window].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

export function bestAverage(solvesNewestFirst: Solve[], n: number): number | null {
  if (solvesNewestFirst.length < n) return null;
  let best: number | null = null;
  for (let i = 0; i + n <= solvesNewestFirst.length; i += 1) {
    const average = averageOf(solvesNewestFirst.slice(i), n);
    if (average === null || !Number.isFinite(average)) continue;
    if (best === null || average < best) best = average;
  }
  return best;
}

export function worstAverage(solvesNewestFirst: Solve[], n: number): number | null {
  if (solvesNewestFirst.length < n) return null;
  let worst: number | null = null;
  for (let i = 0; i + n <= solvesNewestFirst.length; i += 1) {
    const average = averageOf(solvesNewestFirst.slice(i), n);
    if (average === null || !Number.isFinite(average)) continue;
    if (worst === null || average > worst) worst = average;
  }
  return worst;
}

/** Mean of all valid solves, ignoring DNFs. */
export function meanOf(solves: Solve[]): number | null {
  const valid = solves.map(effectiveMs).filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function stdDevOf(solves: Solve[]): number | null {
  const valid = solves.map(effectiveMs).filter((value) => Number.isFinite(value));
  if (valid.length < 2) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

export function bestSingle(solves: Solve[]): number | null {
  let best: number | null = null;
  for (const solve of solves) {
    const value = effectiveMs(solve);
    if (!Number.isFinite(value)) continue;
    if (best === null || value < best) best = value;
  }
  return best;
}

export function worstSingle(solves: Solve[]): number | null {
  let worst: number | null = null;
  for (const solve of solves) {
    const value = effectiveMs(solve);
    if (!Number.isFinite(value)) continue;
    if (worst === null || value > worst) worst = value;
  }
  return worst;
}

export function dnfCount(solves: Solve[]): number {
  return solves.reduce((count, solve) => (solve.penalty === "dnf" ? count + 1 : count), 0);
}

/** Oldest-to-newest valid times, for trend charts. */
export function recentValidTimes(solves: Solve[], limit = 30): number[] {
  const times: number[] = [];
  for (let i = 0; i < solves.length && times.length < limit; i += 1) {
    const value = effectiveMs(solves[i]!);
    if (Number.isFinite(value)) times.push(value);
  }
  return times.reverse();
}

export interface SessionStats {
  count: number;
  validCount: number;
  dnfCount: number;
  best: number | null;
  worst: number | null;
  mean: number | null;
  stdDev: number | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
  bestAo50: number | null;
  bestAo100: number | null;
  worstAo5: number | null;
  worstAo12: number | null;
  worstAo50: number | null;
  worstAo100: number | null;
  totalMs: number;
}

export function computeStats(solves: Solve[]): SessionStats {
  const totalMs = solves.reduce((sum, solve) => {
    const value = effectiveMs(solve);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return {
    count: solves.length,
    validCount: solves.length - dnfCount(solves),
    dnfCount: dnfCount(solves),
    best: bestSingle(solves),
    worst: worstSingle(solves),
    mean: meanOf(solves),
    stdDev: stdDevOf(solves),
    ao5: averageOf(solves, 5),
    ao12: averageOf(solves, 12),
    ao50: averageOf(solves, 50),
    ao100: averageOf(solves, 100),
    bestAo5: bestAverage(solves, 5),
    bestAo12: bestAverage(solves, 12),
    bestAo50: bestAverage(solves, 50),
    bestAo100: bestAverage(solves, 100),
    worstAo5: worstAverage(solves, 5),
    worstAo12: worstAverage(solves, 12),
    worstAo50: worstAverage(solves, 50),
    worstAo100: worstAverage(solves, 100),
    totalMs,
  };
}
