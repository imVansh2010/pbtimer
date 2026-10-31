export type FaceKey = "U" | "R" | "F" | "D" | "L" | "B";

type Vec = readonly [number, number, number];
type Facelets = Record<FaceKey, FaceKey[]>;

const FACES: FaceKey[] = ["U", "R", "F", "D", "L", "B"];

const NORMALS: Record<FaceKey, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

/** In-plane axes so the rendered net matches the standard unfolded layout. */
const BASES: Record<FaceKey, { right: Vec; down: Vec }> = {
  U: { right: [1, 0, 0], down: [0, 0, 1] },
  D: { right: [1, 0, 0], down: [0, 0, -1] },
  R: { right: [0, 0, -1], down: [0, -1, 0] },
  L: { right: [0, 0, 1], down: [0, -1, 0] },
  F: { right: [1, 0, 0], down: [0, -1, 0] },
  B: { right: [-1, 0, 0], down: [0, -1, 0] },
};

interface MoveSpec {
  axis: 0 | 1 | 2;
  sign: 1 | -1;
}

const MOVES: Record<string, MoveSpec> = {
  U: { axis: 1, sign: 1 },
  D: { axis: 1, sign: -1 },
  R: { axis: 0, sign: 1 },
  L: { axis: 0, sign: -1 },
  F: { axis: 2, sign: 1 },
  B: { axis: 2, sign: -1 },
};

interface Sticker {
  normal: Vec;
  face: FaceKey;
}

interface Cubie {
  pos: Vec;
  stickers: Sticker[];
}

const key = (v: Vec): string => v.map((value) => value.toFixed(2)).join(",");

const sameVector = (a: Vec, b: Vec): boolean => key(a) === key(b);

/** Right-handed 90° rotation about an axis (exact for half-integer grids). */
function rotate(v: Vec, axis: 0 | 1 | 2, dir: 1 | -1): Vec {
  const [x, y, z] = v;
  if (axis === 0) return dir === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return dir === 1 ? [z, y, -x] : [-z, y, x];
  return dir === 1 ? [-y, x, z] : [y, -x, z];
}

function buildCube(size: number): Cubie[] {
  const offset = (size - 1) / 2;
  const cubies: Cubie[] = [];

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const pos: Vec = [x - offset, y - offset, z - offset];
        if (pos[0] === 0 && pos[1] === 0 && pos[2] === 0) continue;

        const stickers: Sticker[] = [];
        for (const face of FACES) {
          const normal = NORMALS[face];
          const axis = normal[0] !== 0 ? 0 : normal[1] !== 0 ? 1 : 2;
          const sign = normal[axis]!;
          if (pos[axis] === sign * offset) {
            stickers.push({ normal, face });
          }
        }

        cubies.push({ pos, stickers });
      }
    }
  }

  return cubies;
}

function turn(cubies: Cubie[], face: FaceKey, quarterTurns: number, size: number): void {
  const spec = MOVES[face]!;
  const layer = spec.sign * ((size - 1) / 2);
  const dir: 1 | -1 = spec.sign === 1 ? -1 : 1;

  for (let step = 0; step < quarterTurns; step += 1) {
    for (const cubie of cubies) {
      if (cubie.pos[spec.axis] !== layer) continue;
      cubie.pos = rotate(cubie.pos, spec.axis, dir);
      for (const sticker of cubie.stickers) {
        sticker.normal = rotate(sticker.normal, spec.axis, dir);
      }
    }
  }
}

function readFacelets(cubies: Cubie[], size: number): Facelets {
  const offset = (size - 1) / 2;
  const byPosition = new Map<string, Cubie>();
  for (const cubie of cubies) byPosition.set(key(cubie.pos), cubie);

  const facelets = {} as Facelets;

  for (const face of FACES) {
    const normal = NORMALS[face];
    const { right, down } = BASES[face];
    const cells: FaceKey[] = [];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const pos: Vec = [
          normal[0] * offset + right[0] * (col - offset) + down[0] * (row - offset),
          normal[1] * offset + right[1] * (col - offset) + down[1] * (row - offset),
          normal[2] * offset + right[2] * (col - offset) + down[2] * (row - offset),
        ];
        const cubie = byPosition.get(key(pos));
        const sticker = cubie?.stickers.find((entry) => sameVector(entry.normal, normal));
        cells.push(sticker ? sticker.face : face);
      }
    }

    facelets[face] = cells;
  }

  return facelets;
}

/**
 * Simulates a scramble on an NxN cube. Returns null when the sequence contains
 * notation the 2D net cannot represent (wide turns, slice moves, Square-1, …).
 */
export function computeFacelets(scramble: string, size: number): Facelets | null {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || size < 2) return null;

  const cubies = buildCube(size);

  for (const token of tokens) {
    const match = /^([URFDLB])(['2]?)$/.exec(token.replace(/\u2019/g, "'"));
    if (!match) return null;
    const face = match[1] as FaceKey;
    const quarterTurns = match[2] === "2" ? 2 : match[2] === "'" ? 3 : 1;
    turn(cubies, face, quarterTurns, size);
  }

  return readFacelets(cubies, size);
}
