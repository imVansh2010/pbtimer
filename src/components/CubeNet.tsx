import { memo, useMemo } from "react";
import { computeFacelets, type FaceKey } from "../lib/cube";
import { cn } from "../lib/cn";
import type { PuzzleId } from "../lib/types";

/* Standard cube scheme, spaced apart in hue and lightness so yellow and orange
   never read as the same sticker on a small net. */
const FACE_COLOURS: Record<FaceKey, string> = {
  U: "#f4f4f8",
  R: "#ef4750",
  F: "#21c77a",
  D: "#ffd84a",
  L: "#ff8a3c",
  B: "#4d8bff",
};

/** Net positions in face units: U on top, L F R B across, D below. */
const PLACEMENT: Record<FaceKey, { x: number; y: number }> = {
  U: { x: 1, y: 0 },
  L: { x: 0, y: 1 },
  F: { x: 1, y: 1 },
  R: { x: 2, y: 1 },
  B: { x: 3, y: 1 },
  D: { x: 1, y: 2 },
};

const FACE_GAP = 0.5;
const STICKER_INSET = 0.075;

const NET_SIZES: Partial<Record<PuzzleId, number>> = {
  "222": 2,
  "333": 3,
  "333oh": 3,
  "333bf": 3,
};

/** The net is only meaningful for the puzzles whose geometry it models. */
export function supportsNet(puzzle: PuzzleId): boolean {
  return NET_SIZES[puzzle] !== undefined;
}

interface CubeNetProps {
  scramble: string;
  puzzle: PuzzleId;
  className?: string;
}

/* Memoised: the timer re-renders every frame while running and the net only
   depends on the scramble. */
export const CubeNet = memo(function CubeNet({ scramble, puzzle, className }: CubeNetProps) {
  const size = NET_SIZES[puzzle];
  const facelets = useMemo(() => (size ? computeFacelets(scramble, size) : null), [scramble, size]);

  if (!size || !facelets) return null;

  const stride = size + FACE_GAP;
  const width = 4 * size + 3 * FACE_GAP;
  const height = 3 * size + 2 * FACE_GAP;

  return (
    <div className={cn("rounded-lg bg-ink-950/55 p-1.5", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cube state after the current scramble"
        className="block h-auto w-[122px] md:w-[160px]"
      >
        {(Object.keys(PLACEMENT) as FaceKey[]).map((face) => {
          const { x, y } = PLACEMENT[face];
          return facelets[face].map((colour, index) => {
            const row = Math.floor(index / size);
            const col = index % size;
            return (
              <rect
                key={`${face}-${index}`}
                x={x * stride + col + STICKER_INSET}
                y={y * stride + row + STICKER_INSET}
                width={1 - STICKER_INSET * 2}
                height={1 - STICKER_INSET * 2}
                rx={0.18}
                fill={FACE_COLOURS[colour]}
                stroke="rgba(0,0,0,0.42)"
                strokeWidth={0.05}
              />
            );
          });
        })}
      </svg>
    </div>
  );
});
