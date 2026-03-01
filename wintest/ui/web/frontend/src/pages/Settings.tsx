import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import type { ReactNode } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemePreference; icon: ReactNode; labelKey: string; descKey: string }[] = [
  { value: 'light', icon: <Sun size={20} />, labelKey: 'settings.light', descKey: 'settings.lightDescription' },
  { value: 'dark', icon: <Moon size={20} />, labelKey: 'settings.dark', descKey: 'settings.darkDescription' },
  { value: 'system', icon: <Monitor size={20} />, labelKey: 'settings.system', descKey: 'settings.systemDescription' },
];

const AVAILABLE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
];

export function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('wintest-language', lang);
  };

  return (
    <div className="settings-page">
      <div className="section-header">
        <h2>{t('settings.title')}</h2>
      </div>

      <div className="card">
        <h3>{t('settings.theme')}</h3>
        <p className="text-muted">{t('settings.themeDescription')}</p>
        <div className="theme-options">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`theme-option${theme === opt.value ? ' active' : ''}`}
              onClick={() => setTheme(opt.value)}
            >
              <span className="theme-icon">{opt.icon}</span>
              <span className="theme-label">{t(opt.labelKey)}</span>
              <span className="theme-description">{t(opt.descKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>{t('settings.language')}</h3>
        <p className="text-muted">{t('settings.languageDescription')}</p>
        <select
          className="input"
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          style={{ maxWidth: '300px' }}
        >
          {AVAILABLE_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
