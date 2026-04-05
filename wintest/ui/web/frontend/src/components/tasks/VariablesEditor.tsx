import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

interface VarEntry {
  id: number;
  name: string;
  value: string;
}

interface Props {
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
}

let nextId = 1;

function toEntries(variables: Record<string, string>): VarEntry[] {
  return Object.entries(variables).map(([name, value]) => ({
    id: nextId++,
    name,
    value,
  }));
}

function toRecord(entries: VarEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.name) {
      result[entry.name] = entry.value;
    }
  }
  return result;
}

export function VariablesEditor({ variables, onChange }: Props) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<VarEntry[]>(() => toEntries(variables));

  // Sync from parent when variables change externally (e.g. load test)
  useEffect(() => {
    const parentKeys = Object.keys(variables).sort().join('\0');
    const localKeys = entries.filter(e => e.name).map(e => e.name).sort().join('\0');
    const parentVals = Object.values(variables).sort().join('\0');
    const localVals = entries.filter(e => e.name).map(e => e.value).sort().join('\0');
    if (parentKeys !== localKeys || parentVals !== localVals) {
      setEntries(toEntries(variables));
    }
  }, [variables]);

  const commit = (updated: VarEntry[]) => {
    setEntries(updated);
    onChange(toRecord(updated));
  };

  const updateName = (id: number, name: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, name } : e));
  };

  const commitName = (id: number) => {
    // Commit to parent on blur so the dict key updates once
    onChange(toRecord(entries.map(e => e.id === id ? e : e)));
  };

  const updateValue = (id: number, value: string) => {
    commit(entries.map(e => e.id === id ? { ...e, value } : e));
  };

  const addVariable = () => {
    const updated = [...entries, { id: nextId++, name: '', value: '' }];
    setEntries(updated);
  };

  const removeVariable = (id: number) => {
    commit(entries.filter(e => e.id !== id));
  };

  return (
    <div className="variables-editor">
      {entries.length > 0 && (
        <div className="variables-list">
          {entries.map(entry => (
            <div key={entry.id} className="variables-row">
              <input
                className="input"
                placeholder={t('variablesEditor.namePlaceholder')}
                value={entry.name}
                onChange={e => updateName(entry.id, e.target.value)}
                onBlur={() => commitName(entry.id)}
              />
              <span className="variables-eq">=</span>
              <input
                className="input flex-1"
                placeholder={t('variablesEditor.valuePlaceholder')}
                value={entry.value}
                onChange={e => updateValue(entry.id, e.target.value)}
              />
              <button
                className="btn-icon danger"
                onClick={() => removeVariable(entry.id)}
                title={t('common.remove')}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-secondary btn-sm" onClick={addVariable}>
        <Plus size={14} />{t('variablesEditor.add')}
      </button>
    </div>
  );
}
