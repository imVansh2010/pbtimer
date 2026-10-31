import { useCallback, useEffect, useRef, useState } from "react";
import { generateScramble } from "../lib/scramble";
import type { PuzzleId } from "../lib/types";

interface Prefetched {
  puzzle: PuzzleId;
  text: string;
}

export function useScramble(puzzle: PuzzleId) {
  const [scramble, setScramble] = useState("");
  const [loading, setLoading] = useState(true);

  const nextRef = useRef<Prefetched | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const request = ++requestRef.current;
    nextRef.current = null;
    setLoading(true);
    setScramble("");

    void generateScramble(puzzle).then((text) => {
      if (!alive || requestRef.current !== request) return;
      setScramble(text);
      setLoading(false);
      void generateScramble(puzzle).then((prefetched) => {
        if (!alive || requestRef.current !== request) return;
        nextRef.current = { puzzle, text: prefetched };
      });
    });

    return () => {
      alive = false;
    };
  }, [puzzle]);

  const next = useCallback(() => {
    if (nextRef.current && nextRef.current.puzzle === puzzle) {
      const ready = nextRef.current.text;
      nextRef.current = null;
      setScramble(ready);
      setLoading(false);

      const request = requestRef.current;
      void generateScramble(puzzle).then((prefetched) => {
        if (requestRef.current !== request) return;
        nextRef.current = { puzzle, text: prefetched };
      });
      return;
    }

    const request = ++requestRef.current;
    setLoading(true);
    void generateScramble(puzzle).then((text) => {
      if (requestRef.current !== request) return;
      setScramble(text);
      setLoading(false);
    });
  }, [puzzle]);

  return { scramble, loading, next };
}
