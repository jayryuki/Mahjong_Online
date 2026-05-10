export function getTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('mahjong-theme', theme);
}

export function initTheme(): void {
  const saved = localStorage.getItem('mahjong-theme') as 'light' | 'dark' | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved ?? (prefersDark ? 'dark' : 'light'));
}
