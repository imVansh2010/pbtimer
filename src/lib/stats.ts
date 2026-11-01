import type { Solve } from "./types";

/** Solve time with penalty applied. DNF is Infinity so sorting works for free. */
export function effectiveMs(solve: Solve): number {
  if (solve.penalty === "dnf") return Infinity;
  return solve.ms + (solve.penalty === "plus2" ? 2000 : 0);
}

/**
 * Trimmed mean of one window, without sorting it: a WCA average for five or
 * more solves drops exactly the fastest and the slowest, so the sum, minimum
 * and maximum are enough. A single DNF takes the dropped-slowest slot, and two
 * DNFs make the average a DNF. Windows of three are a plain mean.
 */
function trimmedAverage(solves: Solve[], start: number, n: number): number {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let dnfs = 0;

  for (let index = start; index < start + n; index += 1) {
    const value = effectiveMs(solves[index]!);
    if (!Number.isFinite(value)) {
      dnfs += 1;
      continue;
    }
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (n === 3) return dnfs > 0 ? Infinity : sum / 3;
  if (dnfs > 1) return Infinity;
  return dnfs === 1 ? (sum - min) / (n - 2) : (sum - min - max) / (n - 2);
}

/**
 * Average of the newest `n` solves, using WCA trimming rules.
 * Returns null when there are not enough solves, Infinity for a DNF average.
 */
export function averageOf(solvesNewestFirst: Solve[], n: number): number | null {
  if (n < 3 || solvesNewestFirst.length < n) return null;
  return trimmedAverage(solvesNewestFirst, 0, n);
}

/** Best and worst completed window in one scan, both ignoring DNF averages. */
function averageExtremes(solvesNewestFirst: Solve[], n: number): [number | null, number | null] {
  if (solvesNewestFirst.length < n) return [null, null];
  let best: number | null = null;
  let worst: number | null = null;
  for (let start = 0; start + n <= solvesNewestFirst.length; start += 1) {
    const average = trimmedAverage(solvesNewestFirst, start, n);
    if (!Number.isFinite(average)) continue;
    if (best === null || average < best) best = average;
    if (worst === null || average > worst) worst = average;
  }
  return [best, worst];
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

/** Valid times, oldest first — the order a chart plots them in. */
export function validTimes(solves: Solve[]): number[] {
  const times: number[] = [];
  for (let i = solves.length - 1; i >= 0; i -= 1) {
    const value = effectiveMs(solves[i]!);
    if (Number.isFinite(value)) times.push(value);
  }
  return times;
}

/** Median of values already known to be valid, leaving the input untouched. */
export function medianOfValues(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export interface ChartPoint {
  /** Solve number, counting from the oldest in the window. */
  index: number;
  /** Effective time, or null for a DNF (which is not plottable). */
  value: number | null;
  /** Mean of the valid solves up to this one, over a short window. */
  mean: number | null;
}

/**
 * Newest-first solves become a plottable series: every solve in recording
 * order, plus a rolling mean so a single lucky solve does not read as a trend.
 */
export function trendSeries(solves: Solve[], window = 5): ChartPoint[] {
  const points: ChartPoint[] = [];
  const recent: number[] = [];
  for (let i = solves.length - 1; i >= 0; i -= 1) {
    const value = effectiveMs(solves[i]!);
    if (Number.isFinite(value)) {
      recent.push(value);
      if (recent.length > window) recent.shift();
    }
    const mean = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
    points.push({
      index: points.length + 1,
      value: Number.isFinite(value) ? value : null,
      mean,
    });
  }
  return points;
}

export interface HistogramBucket {
  from: number;
  to: number;
  count: number;
}

/** Equal-width buckets across the valid times, for the distribution chart. */
export function histogram(values: number[], bucketCount = 10): HistogramBucket[] {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return [];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max - min < 1) return [{ from: min, to: max, count: valid.length }];

  const count = Math.max(1, Math.min(bucketCount, valid.length));
  const width = (max - min) / count;
  const buckets: HistogramBucket[] = Array.from({ length: count }, (_, index) => ({
    from: min + index * width,
    to: min + (index + 1) * width,
    count: 0,
  }));
  for (const value of valid) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - min) / width)));
    buckets[index]!.count += 1;
  }
  return buckets;
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
  const dnfs = dnfCount(solves);
  const [bestAo5, worstAo5] = averageExtremes(solves, 5);
  const [bestAo12, worstAo12] = averageExtremes(solves, 12);
  const [bestAo50, worstAo50] = averageExtremes(solves, 50);
  const [bestAo100, worstAo100] = averageExtremes(solves, 100);

  return {
    count: solves.length,
    validCount: solves.length - dnfs,
    dnfCount: dnfs,
    best: bestSingle(solves),
    worst: worstSingle(solves),
    mean: meanOf(solves),
    stdDev: stdDevOf(solves),
    ao5: averageOf(solves, 5),
    ao12: averageOf(solves, 12),
    ao50: averageOf(solves, 50),
    ao100: averageOf(solves, 100),
    bestAo5,
    bestAo12,
    bestAo50,
    bestAo100,
    worstAo5,
    worstAo12,
    worstAo50,
    worstAo100,
    totalMs,
  };
}
