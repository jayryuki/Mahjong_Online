/**
 * Mahjong theme utilities.
 * Supports light and dark themes via CSS custom properties and the `.dark` class on `<html>`.
 * Delegates to @games/ui for theme management but provides local helpers for tile theming.
 */

export type ThemeId = 'light' | 'dark';

const STORAGE_KEY = 'games-theme';

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: ThemeId): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ?? (prefersDark ? 'dark' : 'light'));
}

export const THEMES: { id: ThemeId; label: string; group: 'Light' | 'Dark' }[] = [
  { id: 'light', label: 'Light', group: 'Light' },
  { id: 'dark', label: 'Dark', group: 'Dark' },
];
