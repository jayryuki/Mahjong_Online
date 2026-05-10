import { useState, useEffect } from 'react';
import { getTheme, setTheme } from '../lib/theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return {
    theme,
    toggle: () => setTheme(theme === 'light' ? 'dark' : 'light'),
    set: (t: 'light' | 'dark') => setTheme(t),
  };
}
