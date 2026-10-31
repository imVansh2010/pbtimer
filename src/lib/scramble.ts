import type { PuzzleId } from "./types";

type CubingScrambleModule = typeof import("cubing/scramble");

let modulePromise: Promise<CubingScrambleModule> | null = null;

function loadCubing(): Promise<CubingScrambleModule> {
  modulePromise ??= import("cubing/scramble");
  return modulePromise;
}

/**
 * Official WCA scrambles come from cubing.js, which generates random-state
 * sequences with Twizzle's search workers (the same family of scrambles
 * TNoodle produces for competitions). A local random-move generator is kept
 * as a fallback so the timer never blocks on a network or worker failure.
 */
export async function generateScramble(puzzle: PuzzleId): Promise<string> {
  try {
    const cubing = await withTimeout(loadCubing(), 10_000);
    const alg = await withTimeout(cubing.randomScrambleForEvent(puzzle), 12_000);
    const text = alg
      .toString()
      .replace(/\s+/g, " ")
      .replace(/\s*\/\s*/g, "/ ")
      .trim();
    if (text.length > 0) return text;
  } catch {
    // Fall back to a locally generated sequence.
  }
  return fallbackScramble(puzzle);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Scramble generation timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Local fallback                                                     */
/* ------------------------------------------------------------------ */

const MODIFIERS = ["", "'", "2"] as const;
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomMoves(faces: readonly string[], count: number, wide = false): string[] {
  const moves: string[] = [];
  let previousFace = "";
  let previousPreviousFace = "";

  while (moves.length < count) {
    const face = pick(faces);
    if (face === previousFace) continue;
    if (
      face === previousPreviousFace &&
      AXIS[face] !== undefined &&
      AXIS[face] === AXIS[previousFace]
    ) {
      continue;
    }

    let suffix = "";
    if (wide) {
      // Big cubes occasionally use wide turns so the scramble looks realistic.
      const roll = Math.random();
      if (roll > 0.82) suffix = "w";
      else if (roll > 0.76) suffix = "3w";
    }

    moves.push(`${face}${suffix}${pick(MODIFIERS)}`);
    previousPreviousFace = previousFace;
    previousFace = face;
  }

  return moves;
}

function fallbackScramble(puzzle: PuzzleId): string {
  switch (puzzle) {
    case "222":
      return randomMoves(["R", "U", "F"], 11).join(" ");
    case "333":
    case "333oh":
    case "333bf":
      return randomMoves(["U", "D", "R", "L", "F", "B"], 21).join(" ");
    case "444":
      return randomMoves(["U", "D", "R", "L", "F", "B"], 40, true).join(" ");
    case "555":
      return randomMoves(["U", "D", "R", "L", "F", "B"], 60, true).join(" ");
    case "666":
      return randomMoves(["U", "D", "R", "L", "F", "B"], 80, true).join(" ");
    case "777":
      return randomMoves(["U", "D", "R", "L", "F", "B"], 100, true).join(" ");
    case "pyram": {
      const moves = randomMoves(["U", "L", "R", "B"], 11);
      const tips = ["u", "l", "r", "b"].filter(() => Math.random() > 0.5);
      return [...moves, ...tips.map((tip) => `${tip}${pick(MODIFIERS)}`)].join(" ");
    }
    case "skewb":
      return randomMoves(["R", "U", "L", "B"], 11).join(" ");
    case "minx": {
      const groups: string[] = [];
      for (let row = 0; row < 7; row += 1) {
        const moves: string[] = [];
        for (let i = 0; i < 10; i += 1) {
          const face = i % 2 === 0 ? "R" : "D";
          moves.push(`${face}${Math.random() > 0.5 ? "++" : "--"}`);
        }
        groups.push(`R ${moves.join(" ")}`);
      }
      return groups.join("\n");
    }
    case "sq1": {
      const pairs: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        const top = Math.floor(Math.random() * 12) - 6;
        const bottom = Math.floor(Math.random() * 12) - 6;
        pairs.push(`(${top},${bottom})`);
      }
      return `${pairs.join("/")} /`;
    }
    default:
      return randomMoves(["U", "D", "R", "L", "F", "B"], 21).join(" ");
  }
}
