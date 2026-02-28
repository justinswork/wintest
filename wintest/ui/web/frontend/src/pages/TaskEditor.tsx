import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useTaskStore } from '../stores/taskStore';
import { useExecutionStore } from '../stores/executionStore';
import { StepList } from '../components/tasks/StepList';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { showToast } from '../components/common/Toast';
import type { Task, Step } from '../api/types';
import { newStep } from '../api/types';

const EMPTY_TASK: Task = {
  name: '',
  filename: null,
  application: null,
  steps: [newStep()],
  settings: {},
};

export function TaskEditor() {
  const { filename } = useParams<{ filename: string }>();
  const navigate = useNavigate();
  const { fetchTask, fetchActions, saveTask, validateTask, validation, loading } = useTaskStore();
  const { startRun, status } = useExecutionStore();
  const isEditing = !!filename;

  const [task, setTask] = useState<Task>({ ...EMPTY_TASK, steps: [newStep()] });
  const [appEnabled, setAppEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(filename ?? null);
  const [dirty, setDirty] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const lastLoadedRef = useRef<string | undefined>(undefined);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // Load task on mount or reset state when navigating between edit and new
  useEffect(() => {
    if (filename === lastLoadedRef.current) return;
    lastLoadedRef.current = filename;

    useTaskStore.setState({ validation: null });

    if (filename) {
      fetchTask(filename).then(() => {
        const store = useTaskStore.getState();
        if (store.currentTask) {
          setTask(store.currentTask);
          setAppEnabled(!!store.currentTask.application);
          setSavedFilename(filename);
        }
      });
    } else {
      setTask({ ...EMPTY_TASK, steps: [newStep()] });
      setAppEnabled(false);
      setSavedFilename(null);
    }
    setDirty(false);
  }, [filename, fetchTask]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

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

  const updateTask = useCallback((updated: Task) => {
    setTask(updated);
    setDirty(true);
  }, []);

  // Prompt before navigating away with unsaved changes
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm('You have unsaved changes. Leave without saving?');
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

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
      const saved = await saveTask(task, savedFilename ?? undefined);
      setSavedFilename(saved);
      setDirty(false);
      showToast('Task saved successfully');
    } catch {
      showToast('Failed to save task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    setShowSaveMenu(false);

    const defaultName = (task.name || 'my_task')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '') + '.yaml';
    const newFilename = window.prompt('Save as filename:', defaultName);
    if (!newFilename) return;

    const normalized = newFilename.endsWith('.yaml') ? newFilename : newFilename + '.yaml';

    setSaving(true);
    try {
      await saveTask(task, normalized);
      setSavedFilename(normalized);
      setDirty(false);
      showToast(`Saved as ${normalized}`);
      navigate(`/tasks/${normalized}/edit`, { replace: true });
    } catch {
      showToast('Failed to save task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (savedFilename) {
      if (dirty) await handleSave();
      await validateTask(savedFilename);
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
    updateTask({ ...task, steps });
  };

  const addStep = () => {
    updateTask({ ...task, steps: [...task.steps, newStep()] });
  };

  if (loading && isEditing) return <LoadingSpinner message="Loading task..." />;

  return (
    <div className="task-editor">
      <div className="section-header">
        <h2>{isEditing ? `Edit: ${task.name}` : 'New Task'}</h2>
        <div className="header-actions">
          {savedFilename && (
            <button className="btn btn-secondary" onClick={handleValidate}>Validate</button>
          )}

          <div className="save-button-group" ref={saveMenuRef}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !task.name || !dirty}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {savedFilename && (
              <button
                className="btn btn-primary save-menu-toggle"
                onClick={() => setShowSaveMenu(!showSaveMenu)}
                disabled={saving || !task.name}
              >
                &#x25BE;
              </button>
            )}
            {showSaveMenu && (
              <div className="save-dropdown">
                <button className="save-dropdown-item" onClick={handleSaveAs}>
                  Save As New...
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
              Run
            </button>
          )}
        </div>
      </div>

      {validation && (
        <div className={`validation-box ${validation.valid ? 'valid' : 'invalid'}`}>
          {validation.valid ? (
            <p>Task is valid.</p>
          ) : (
            <ul>{validation.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
          )}
        </div>
      )}

      <div className="form-group">
        <label>Task Name</label>
        <input
          className="input"
          value={task.name}
          onChange={e => updateTask({ ...task, name: e.target.value })}
          placeholder="e.g. Notepad Basic Test"
        />
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={appEnabled}
            onChange={e => {
              setAppEnabled(e.target.checked);
              if (!e.target.checked) updateTask({ ...task, application: null });
              else updateTask({ ...task, application: { path: '', title: '', wait_after_launch: 3 } });
            }}
          />
          {' '}Launch Application
        </label>
        {appEnabled && task.application && (
          <div className="app-config">
            <input
              className="input"
              placeholder="Application path (e.g. notepad.exe)"
              value={(task.application.path as string) ?? ''}
              onChange={e => updateTask({ ...task, application: { ...task.application!, path: e.target.value } })}
            />
            <input
              className="input"
              placeholder="Window title (optional)"
              value={(task.application.title as string) ?? ''}
              onChange={e => updateTask({ ...task, application: { ...task.application!, title: e.target.value } })}
            />
            <input
              className="input"
              type="number"
              placeholder="Wait after launch (seconds)"
              value={(task.application.wait_after_launch as number) ?? 3}
              onChange={e => updateTask({ ...task, application: { ...task.application!, wait_after_launch: parseFloat(e.target.value) || 3 } })}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Steps</label>
        <StepList steps={task.steps} onChange={handleStepsChange} />
        <button className="btn btn-secondary" onClick={addStep} style={{ marginTop: '0.5rem' }}>
          + Add Step
        </button>
      </div>
    </div>
  );
}
