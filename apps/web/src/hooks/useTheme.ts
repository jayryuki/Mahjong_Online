import { useState, useEffect } from 'react';
import { getTheme, getThemeStyle, setTheme, ThemeId, THEMES } from '../lib/theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);
  const [themeStyle, setThemeStyleState] = useState(getThemeStyle);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeState(getTheme());
      setThemeStyleState(getThemeStyle());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme-style'] });
    return () => observer.disconnect();
  }, []);

  return {
    theme,
    themeStyle,
    set: (t: ThemeId) => setTheme(t),
    themes: THEMES,
  };
}
