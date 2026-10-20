import { useCallback, useEffect, useRef, useState } from 'react';

/** Memutar langkah berurutan (`at` dalam ms sejak mulai). Mengembalikan langkah aktif dan restart(). */
export function useTimeline<T extends { at: number }>(steps: readonly T[]) {
  const [index, setIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const schedule = useCallback(() => {
    clear();
    steps.forEach((s, i) => {
      if (i > 0) timers.current.push(setTimeout(() => setIndex(i), s.at));
    });
  }, [steps, clear]);

  const restart = useCallback(() => {
    setIndex(0);
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    return clear;
  }, [schedule, clear]);

  return { step: steps[index]!, restart };
}
