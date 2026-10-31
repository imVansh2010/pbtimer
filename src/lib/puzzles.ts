import type { PuzzleId } from "./types";

export interface Puzzle {
  id: PuzzleId;
  label: string;
  short: string;
}

export interface PuzzleGroup {
  label: string;
  items: Puzzle[];
}

export const PUZZLE_GROUPS: PuzzleGroup[] = [
  {
    label: "Cubes",
    items: [
      { id: "222", label: "2 × 2", short: "2×2" },
      { id: "333", label: "3 × 3", short: "3×3" },
      { id: "444", label: "4 × 4", short: "4×4" },
      { id: "555", label: "5 × 5", short: "5×5" },
      { id: "666", label: "6 × 6", short: "6×6" },
      { id: "777", label: "7 × 7", short: "7×7" },
    ],
  },
  {
    label: "3 × 3 events",
    items: [
      { id: "333oh", label: "One-handed", short: "OH" },
      { id: "333bf", label: "Blindfolded", short: "BLD" },
    ],
  },
  {
    label: "Other puzzles",
    items: [
      { id: "pyram", label: "Pyraminx", short: "Pyra" },
      { id: "skewb", label: "Skewb", short: "Skewb" },
      { id: "minx", label: "Megaminx", short: "Mega" },
      { id: "sq1", label: "Square-1", short: "Sq-1" },
    ],
  },
];

export const ALL_PUZZLES: Puzzle[] = PUZZLE_GROUPS.flatMap((group) => group.items);

export function puzzleById(id: PuzzleId): Puzzle {
  return ALL_PUZZLES.find((p) => p.id === id) ?? ALL_PUZZLES[1]!;
}

export function isPuzzleId(value: unknown): value is PuzzleId {
  return typeof value === "string" && ALL_PUZZLES.some((p) => p.id === value);
}
