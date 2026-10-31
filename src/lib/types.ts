export type Penalty = "ok" | "plus2" | "dnf";

export type PuzzleId =
  | "222"
  | "333"
  | "444"
  | "555"
  | "666"
  | "777"
  | "333oh"
  | "333bf"
  | "pyram"
  | "skewb"
  | "minx"
  | "sq1";

export interface Solve {
  /** UUID, so the same solve keeps its identity across devices. */
  id: string;
  /** Raw timer time in milliseconds, before penalty. */
  ms: number;
  penalty: Penalty;
  scramble: string;
  puzzle: PuzzleId;
  /** Epoch milliseconds. */
  date: number;
  /** Epoch milliseconds of the last edit (penalty), used when merging devices. */
  updatedAt?: number;
}

export interface Settings {
  /** WCA 15 second inspection before each attempt. */
  inspection: boolean;
  /** How long the space bar must be held before the timer arms. */
  holdMs: number;
  /** Keep the digits blank while the timer runs. */
  hideRunningTime: boolean;
  /** Accent palette id from `lib/accents`. */
  accent: string;
}
