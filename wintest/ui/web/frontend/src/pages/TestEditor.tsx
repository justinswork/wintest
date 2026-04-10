import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, CheckCircle, Play, Plus } from 'lucide-react';
import { useTestStore } from '../stores/testStore';
import { useExecutionStore } from '../stores/executionStore';
import { StepList } from '../components/tasks/StepList';
import { VariablesEditor } from '../components/tasks/VariablesEditor';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { showToast } from '../components/common/Toast';
import type { Test, Step } from '../api/types';
import { newStep } from '../api/types';

const EMPTY_TEST: Test = {
  name: '',
  filename: null,
  steps: [newStep()],
  settings: {},
  variables: {},
  tags: [],
};

export function TestEditor() {
  const { t } = useTranslation();
  const { '*': filename } = useParams();
  const navigate = useNavigate();
  const { fetchTest, fetchStepTypes, saveTest, validateTest, validation, loading } = useTestStore();
  const { startRun, status } = useExecutionStore();
  const isEditing = !!filename;

  const [test, setTest] = useState<Test>({ ...EMPTY_TEST, steps: [newStep()] });
  const [saving, setSaving] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(filename ?? null);
  const [dirty, setDirty] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const lastLoadedRef = useRef<string | undefined>(undefined);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // Load test on mount or reset state when navigating between edit and new
  useEffect(() => {
    if (filename === lastLoadedRef.current) return;
    lastLoadedRef.current = filename;

    useTestStore.setState({ validation: null });

    if (filename) {
      fetchTest(filename).then(() => {
        const store = useTestStore.getState();
        if (store.currentTest) {
          setTest(store.currentTest);
          setSavedFilename(filename);
        }
      });
    } else {
      setTest({ ...EMPTY_TEST, steps: [newStep()] });
      setSavedFilename(null);
    }
    setDirty(false);
  }, [filename, fetchTest]);

  useEffect(() => {
    fetchStepTypes();
  }, [fetchStepTypes]);

  // Close save menu on outside click
  useEffect(() => {
    if (!showSaveMenu) return;
    const handler = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSaveMenu]);

  const updateTest = useCallback((updated: Test) => {
    setTest(updated);
    setDirty(true);
  }, []);

  // Prompt before navigating away with unsaved changes
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm(t('testEditor.unsavedChanges'));
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, t]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveTest(test, savedFilename ?? undefined);
      setSavedFilename(saved);
      setDirty(false);
      showToast(t('testEditor.saved'));
    } catch {
      showToast(t('testEditor.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    setShowSaveMenu(false);

    const defaultName = (test.name || 'my_test')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '') + '.yaml';
    const newFilename = window.prompt(t('testEditor.saveAsPrompt'), defaultName);
    if (!newFilename) return;

    const normalized = newFilename.endsWith('.yaml') ? newFilename : newFilename + '.yaml';

    setSaving(true);
    try {
      await saveTest(test, normalized);
      setSavedFilename(normalized);
      setDirty(false);
      showToast(t('testEditor.savedAs', { filename: normalized }));
      navigate(`/tests/edit/${normalized}`, { replace: true });
    } catch {
      showToast(t('testEditor.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (savedFilename) {
      if (dirty) await handleSave();
      await validateTest(savedFilename);
    }
  };

  const handleRun = async () => {
    if (savedFilename) {
      if (dirty) await handleSave();
      await startRun(savedFilename);
      navigate('/execution');
    }
  };

  const handleStepsChange = (steps: Step[]) => {
    updateTest({ ...test, steps });
  };

  const addStep = () => {
    updateTest({ ...test, steps: [...test.steps, newStep()] });
  };

  if (loading && isEditing) return <LoadingSpinner message={t('testEditor.loading')} />;

  return (
    <div className="test-editor">
      <div className="section-header">
        <h2>{isEditing ? t('testEditor.editTest', { name: test.name }) : t('testEditor.newTest')}</h2>
        <div className="header-actions">
          {savedFilename && (
            <button className="btn btn-secondary" onClick={handleValidate}><CheckCircle size={16} />{t('testEditor.validate')}</button>
          )}

          <div className="save-button-group" ref={saveMenuRef}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !test.name || !dirty}
            >
              <Save size={16} />{saving ? t('testEditor.saving') : t('testEditor.save')}
            </button>
            {savedFilename && (
              <button
                className="btn btn-primary save-menu-toggle"
                onClick={() => setShowSaveMenu(!showSaveMenu)}
                disabled={saving || !test.name}
              >
                &#x25BE;
              </button>
            )}
            {showSaveMenu && (
              <div className="save-dropdown">
                <button className="save-dropdown-item" onClick={handleSaveAs}>
                  {t('testEditor.saveAsNew')}
                </button>
              </div>
            )}
          </div>

          {savedFilename && (
            <button
              className="btn btn-success"
              onClick={handleRun}
              disabled={status === 'running'}
            >
              <Play size={16} />{t('testEditor.run')}
            </button>
          )}
        </div>
      </div>

      {validation && (
        <div className={`validation-box ${validation.valid ? 'valid' : 'invalid'}`}>
          {validation.valid ? (
            <p>{t('testEditor.valid')}</p>
          ) : (
            <ul>{validation.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
          )}
        </div>
      )}

      <div className="form-group">
        <label>{t('testEditor.testName')}</label>
        <input
          className="input"
          value={test.name}
          onChange={e => updateTest({ ...test, name: e.target.value })}
          placeholder={t('testEditor.testNamePlaceholder')}
        />
      </div>

      <TagsInput
        tags={test.tags ?? []}
        onChange={tags => updateTest({ ...test, tags })}
        label={t('testEditor.tags')}
      />

      <div className="form-group">
        <label>{t('testEditor.variables')}</label>
        <VariablesEditor
          variables={test.variables ?? {}}
          onChange={vars => updateTest({ ...test, variables: vars })}
        />
      </div>

      <div className="form-group">
        <label>{t('testEditor.steps')}</label>
        <StepList steps={test.steps} onChange={handleStepsChange} />
        <button className="btn btn-secondary" onClick={addStep} style={{ marginTop: '0.5rem' }}>
          <Plus size={16} />{t('testEditor.addStep')}
        </button>
      </div>
    </div>
  );
}

function TagsInput({ tags, onChange, label }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const commitTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setNewTag('');
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="tags-input">
        {tags.map(tag => (
          <span key={tag} className="tag-chip">
            {tag}
            <button className="tag-chip-remove" onClick={() => removeTag(tag)}>&times;</button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            className="input tag-input-inline"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onBlur={commitTag}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTag();
              if (e.key === 'Escape') { setNewTag(''); setAdding(false); }
            }}
            placeholder={t('testEditor.tagInputPlaceholder')}
          />
        ) : (
          <button className="tag-add-btn" onClick={() => setAdding(true)}>+</button>
        )}
      </div>
    </div>
  );
}
