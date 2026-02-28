import { create } from 'zustand';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference) {
  const resolved = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.setAttribute('data-theme', resolved);
}

const stored = (localStorage.getItem('wintest-theme') as ThemePreference) ?? 'system';
applyTheme(stored);

// Listen for OS theme changes when preference is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = useThemeStore.getState().theme;
  if (current === 'system') {
    applyTheme('system');
  }
});

export const useThemeStore = create<ThemeState>((set) => ({
  theme: stored,
  setTheme: (theme) => {
    localStorage.setItem('wintest-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
}));
