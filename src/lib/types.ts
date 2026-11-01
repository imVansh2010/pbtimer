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
  /** Session this solve belongs to. Solves from older files have none until adopted. */
  sessionId?: string;
}

/**
 * A run of solves for one event. Sessions are kept separately from the solves
 * so a solve only carries its session's id, and a session can be browsed after
 * a newer one has taken over.
 */
export interface Session {
  id: string;
  puzzle: PuzzleId;
  /** Shown in the header, the side panel and the statistics section. */
  name: string;
  /** Epoch milliseconds when the session was started. */
  createdAt: number;
  /** Where it came from: recorded here, or created by an import. */
  source: "timer" | "import";
  /** The session that holds solves inherited from before sessions existed. */
  adopted?: boolean;
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
