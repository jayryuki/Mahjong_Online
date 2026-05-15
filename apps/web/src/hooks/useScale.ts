import { useState, useEffect } from 'react';

/**
 * Returns a responsive scale factor based on viewport width.
 * Desktop (>=900px): 1.0 — full 1.5x tiles / 2x text
 * Tablet (600-899px): 0.75
 * Mobile (<600px): 0.55
 */
export function useScale() {
  const [scale, setScale] = useState(() => {
    const w = window.innerWidth;
    if (w < 600) return 0.55;
    if (w < 900) return 0.75;
    return 1;
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setScale(0.55);
      else if (w < 900) setScale(0.75);
      else setScale(1);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}
