export type ThemeId =
  | 'light'
  | 'ivory-jade'
  | 'paper-crimson'
  | 'dark'
  | 'midnight-ink'
  | 'ember-jade';

const STORAGE_KEY = 'mahjong-theme';

export function getTheme(): ThemeId {
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'light';
}

export function setTheme(theme: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
  const saved = getTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

export const THEMES: { id: ThemeId; label: string; group: 'Light' | 'Dark' }[] = [
  { id: 'light', label: 'Default Light', group: 'Light' },
  { id: 'ivory-jade', label: 'Ivory Jade', group: 'Light' },
  { id: 'paper-crimson', label: 'Paper Crimson', group: 'Light' },
  { id: 'dark', label: 'Default Dark', group: 'Dark' },
  { id: 'midnight-ink', label: 'Midnight Ink', group: 'Dark' },
  { id: 'ember-jade', label: 'Ember Jade', group: 'Dark' },
];
