import { useState, useEffect } from 'react';
import { getTheme, setTheme, ThemeId, THEMES } from '../lib/theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return {
    theme,
    set: (t: ThemeId) => setTheme(t),
    themes: THEMES,
  };
}
