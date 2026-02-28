import { useThemeStore } from '../stores/themeStore';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string; description: string }[] = [
  { value: 'light', label: 'Light', icon: '☀', description: 'Light background with dark text' },
  { value: 'dark', label: 'Dark', icon: '🌙', description: 'Dark background with light text' },
  { value: 'system', label: 'System', icon: '💻', description: 'Follow your operating system setting' },
];

export function Settings() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="settings-page">
      <div className="section-header">
        <h2>Settings</h2>
      </div>

      <div className="card">
        <h3>Theme</h3>
        <p className="text-muted">Choose how wintest looks to you.</p>
        <div className="theme-options">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`theme-option${theme === opt.value ? ' active' : ''}`}
              onClick={() => setTheme(opt.value)}
            >
              <span className="theme-icon">{opt.icon}</span>
              <span className="theme-label">{opt.label}</span>
              <span className="theme-description">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
