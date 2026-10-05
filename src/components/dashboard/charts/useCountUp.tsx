'use client';

import { useEffect, useState } from 'react';

export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = (now: number) => {
      if (reduceMotion) {
        setValue(target);
        return;
      }
      if (start === null) start = now + delay;
      const progress = Math.min(Math.max((now - start) / duration, 0), 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay]);

  return value;
}

export function CountUp({ value, delay = 0, suffix = '' }: { value: number; delay?: number; suffix?: string }) {
  const current = useCountUp(value, 900, delay);
  return (
    <>
      {current}
      {suffix}
    </>
  );
}
