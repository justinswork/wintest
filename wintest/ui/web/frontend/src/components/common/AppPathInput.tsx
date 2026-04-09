import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { savedAppsApi, fileApi } from '../../api/client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function AppPathInput({ value, onChange, placeholder, disabled, onKeyDown }: Props) {
  const { t } = useTranslation();
  const [savedApps, setSavedApps] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savedAppsApi.list().then(setSavedApps);
  }, []);

  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [focused]);

  const filtered = value
    ? savedApps.filter(app => app.toLowerCase().includes(value.toLowerCase()))
    : savedApps;

  const handleSelect = (app: string) => {
    onChange(app);
    setShowDropdown(false);
  };

  const handleBrowse = async () => {
    try {
      const path = await fileApi.pickExecutable();
      onChange(path);
      // Auto-save the browsed path
      savedAppsApi.add(path).then(() => {
        setSavedApps(prev => prev.includes(path) ? prev : [...prev, path]);
      });
    } catch { /* cancelled */ }
  };

  return (
    <div className="app-path-input" ref={wrapperRef}>
      <div className="app-path-input-row">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setShowDropdown(true); }}
          onFocus={() => { setFocused(true); if (savedApps.length > 0) setShowDropdown(true); }}
          onBlur={() => {
            // Auto-save on blur if non-empty
            if (value && !savedApps.includes(value)) {
              savedAppsApi.add(value).then(() => {
                setSavedApps(prev => [...prev, value]);
              });
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setShowDropdown(false);
            onKeyDown?.(e);
          }}
          disabled={disabled}
        />
        <button
          className="btn-icon"
          onClick={handleBrowse}
          title={t('appPath.browse')}
          type="button"
          disabled={disabled}
        >
          <FolderOpen size={16} />
        </button>
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="app-path-dropdown">
          {filtered.map(app => (
            <button
              key={app}
              className="app-path-dropdown-item"
              onMouseDown={() => handleSelect(app)}
            >
              {app}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
