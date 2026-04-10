import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Trash2, Save, Square, Check, ChevronDown, ChevronRight, Camera } from 'lucide-react';
import { builderApi } from '../api/client';
import { AppPathInput } from '../components/common/AppPathInput';
import { VariablesEditor } from '../components/tasks/VariablesEditor';
import { useTestStore } from '../stores/testStore';
import { showToast } from '../components/common/Toast';
import { StatusBadge } from '../components/common/StatusBadge';
import type { Step } from '../api/types';
import { newStep } from '../api/types';

interface BuilderStep {
  step: Step;
  passed: boolean;
  error: string | null;
  coordinates: number[] | null;
  model_response: string | null;
  duration_seconds: number;
  screenshot_base64: string | null;
}

export function TestBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { saveTest, stepTypes, fetchStepTypes } = useTestStore();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [lastStepTime, setLastStepTime] = useState<number | null>(null);
  const [pendingStep, setPendingStep] = useState<{ step: BuilderStep; stepData: Record<string, unknown> } | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenshotRef = useRef<HTMLImageElement>(null);
  const [action, setAction] = useState('launch_application');
  const [target, setTarget] = useState('');
  const [text, setText] = useState('');
  const [key, setKey] = useState('');
  const [keys, setKeys] = useState('');
  const [scrollAmount, setScrollAmount] = useState(3);
  const [waitSeconds, setWaitSeconds] = useState(1);
  const [appPath, setAppPath] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variableName, setVariableName] = useState('');
  const [variableValue, setVariableValue] = useState('');
  const [loopTarget, setLoopTarget] = useState(1);
  const [repeatCount, setRepeatCount] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const handleStart = async () => {
    setLoading(true);
    try {
      await builderApi.start();
      setActive(true);
      setSteps([]);
      setScreenshot(null);
      setSelectedStep(null);
      setExpandedStep(null);
      setPendingStep(null);
      setPickMode(false);
      setShowRunMenu(false);
      setAction('launch_application');
      setTarget('');
      setText('');
      setKey('');
      setKeys('');
      setScrollAmount(3);
      setWaitSeconds(1);
      setAppPath('');
      setAppTitle('');
      setDescription('');
      setVariableName('');
      setVariableValue('');
      setLoopTarget(1);
      setRepeatCount(1);
      setTags([]);
      setVariables({});
      showToast(t('builder.started'));
    } catch {
      showToast(t('builder.startFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      await builderApi.stop();
    } catch { /* ignore */ }
    setActive(false);
    showToast(t('builder.stopped'));
  };

  const handleCapture = async () => {
    try {
      const res = await builderApi.screenshot();
      setScreenshot(res.screenshot_base64);
      setSelectedStep(null);

      // If the last step was launch_application, compute elapsed time
      // and set it as wait_seconds on that step
      if (lastStepTime && steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        if (lastStep.step.action === 'launch_application') {
          const elapsed = Math.round((Date.now() - lastStepTime) / 1000);
          setSteps(prev => prev.map((s, i) =>
            i === prev.length - 1
              ? { ...s, step: { ...s.step, wait_seconds: elapsed }, screenshot_base64: res.screenshot_base64 }
              : s
          ));
        }
      }
      setLastStepTime(null);
    } catch {
      showToast(t('builder.captureFailed'), 'error');
    }
  };

  const handleStartPick = async () => {
    // Capture a fresh screenshot for the user to click on
    try {
      const res = await builderApi.screenshot();
      setScreenshot(res.screenshot_base64);
      setSelectedStep(null);
      setPickMode(true);
    } catch {
      showToast(t('builder.captureFailed'), 'error');
    }
  };

  const handleScreenshotClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pickMode || executing) return;

    const img = screenshotRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    setPickMode(false);
    setExecuting(true);

    try {
      const stepData: Record<string, unknown> = {
        action,
        description: description || `${action} at (${Math.round(clickX * 100)}%, ${Math.round(clickY * 100)}%)`,
        click_x: clickX,
        click_y: clickY,
      };
      const result = await builderApi.step(stepData);
      const builderStep: BuilderStep = {
        step: buildStepRecord(stepData),
        passed: result.passed,
        error: result.error,
        coordinates: result.coordinates ?? null,
        model_response: result.model_response ?? null,
        duration_seconds: result.duration_seconds ?? 0,
        screenshot_base64: result.screenshot_base64,
      };

      // Show post-click screenshot in viewer, save pre-click on step
      setPendingStep({ step: builderStep, stepData });
      setScreenshot(result.post_screenshot_base64 ?? result.screenshot_base64 ?? null);
      setSelectedStep(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Step failed';
      showToast(msg, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const buildStepFromForm = (): Record<string, unknown> => {
    const step: Record<string, unknown> = { action, description: description || undefined };
    switch (action) {
      case 'click':
      case 'double_click':
      case 'right_click':
      case 'verify':
        step.target = target;
        break;
      case 'type':
        step.text = text;
        break;
      case 'press_key':
        step.key = key;
        break;
      case 'hotkey':
        step.keys = keys.split(',').map(k => k.trim()).filter(Boolean);
        break;
      case 'scroll':
        step.scroll_amount = scrollAmount;
        break;
      case 'wait':
        step.wait_seconds = waitSeconds;
        break;
      case 'launch_application':
        step.app_path = appPath;
        step.app_title = appTitle || undefined;
        step.wait_seconds = 1; // minimal wait; real value set when user clicks Screenshot
        break;
      case 'set_variable':
        step.variable_name = variableName;
        step.variable_value = variableValue;
        break;
      case 'loop':
        step.loop_target = loopTarget;
        step.repeat = repeatCount;
        break;
    }
    return step;
  };

  const buildStepRecord = (data: Record<string, unknown>): Step => {
    return {
      ...newStep(),
      ...data,
    } as Step;
  };

  const acceptPendingStep = () => {
    if (!pendingStep) return;
    setSteps(prev => [...prev, pendingStep.step]);
    setSelectedStep(null);
    setPendingStep(null);
    // Reset for next step
    setAction('click');
    setTarget('');
    setText('');
    setKey('');
    setKeys('');
    setAppPath('');
    setAppTitle('');
    setDescription('');
    setVariableName('');
    setVariableValue('');
    setLoopTarget(1);
    setRepeatCount(1);
  };

  const retryPendingStep = () => {
    const wasCoordinatePick = pendingStep?.step.step.click_x != null;
    setPendingStep(null);
    if (wasCoordinatePick) {
      // Go back to pick mode with the pre-click screenshot
      handleStartPick();
    } else {
      setScreenshot(null);
    }
  };

  const handleSaveStep = () => {
    const stepData = buildStepFromForm();
    const builderStep: BuilderStep = {
      step: buildStepRecord(stepData),
      passed: true,
      error: null,
      coordinates: null,
      model_response: null,
      duration_seconds: 0,
      screenshot_base64: null,
    };
    setSteps(prev => [...prev, builderStep]);
    setSelectedStep(steps.length);

    // Reset for next step
    setAction('click');
    setTarget('');
    setText('');
    setKey('');
    setKeys('');
    setAppPath('');
    setAppTitle('');
    setDescription('');
    setVariableName('');
    setVariableValue('');
    setLoopTarget(1);
    setRepeatCount(1);
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const stepData = buildStepFromForm();
      const result = await builderApi.step(stepData);
      const builderStep: BuilderStep = {
        step: buildStepRecord(stepData),
        passed: result.passed,
        error: result.error,
        coordinates: result.coordinates ?? null,
        model_response: result.model_response ?? null,
        duration_seconds: result.duration_seconds ?? 0,
        screenshot_base64: result.screenshot_base64,
      };

      setLastStepTime(Date.now());

      if (result.needs_confirmation) {
        // Show annotated screenshot and wait for user to accept or retry
        setPendingStep({ step: builderStep, stepData });
        if (result.screenshot_base64) {
          setScreenshot(result.screenshot_base64);
          setSelectedStep(null);
        }
      } else {
        // Non-vision steps (type, wait, launch, etc.) — accept immediately
        setSteps(prev => [...prev, builderStep]);
        setSelectedStep(steps.length);

        if (action !== 'launch_application' && result.screenshot_base64) {
          setScreenshot(result.screenshot_base64);
        }

        // Reset for next step
        setAction('click');
        setTarget('');
        setText('');
        setKey('');
        setKeys('');
        setAppPath('');
        setAppTitle('');
        setDescription('');
    setVariableName('');
    setVariableValue('');
    setLoopTarget(1);
    setRepeatCount(1);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Step failed';
      showToast(msg, 'error');
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchStepTypes();
  }, [fetchStepTypes]);

  useEffect(() => {
    if (!pickMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pickMode]);

  useEffect(() => {
    if (!showRunMenu) return;
    const handler = (e: MouseEvent) => {
      if (runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) {
        setShowRunMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRunMenu]);

  const handleRemoveStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
    if (selectedStep === index) setSelectedStep(null);
    else if (selectedStep !== null && selectedStep > index) setSelectedStep(selectedStep - 1);
    if (expandedStep === index) setExpandedStep(null);
    else if (expandedStep !== null && expandedStep > index) setExpandedStep(expandedStep - 1);
  };

  const handleUpdateStep = (index: number, updated: BuilderStep) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const handleSaveAsTest = async () => {
    const testName = window.prompt(t('builder.testNamePrompt'), 'New Test');
    if (!testName) return;
    try {
      const test = {
        name: testName,
        filename: null,
        steps: steps.map(s => s.step),
        settings: {},
        variables,
        tags,
      };
      await saveTest(test);
      showToast(t('builder.saved'));
      navigate('/tests');
    } catch {
      showToast(t('builder.saveFailed'), 'error');
    }
  };

  // Focus input when session starts
  useEffect(() => {
    if (active && inputRef.current) inputRef.current.focus();
  }, [active]);

  const displayedScreenshot = selectedStep !== null && steps[selectedStep]?.screenshot_base64
    ? steps[selectedStep].screenshot_base64
    : screenshot;

  const renderFieldsForAction = () => {
    switch (action) {
      case 'click':
      case 'double_click':
      case 'right_click':
        return (
          <>
            <button
              className="btn btn-secondary"
              onClick={handleStartPick}
              disabled={executing || pickMode}
            >
              {t('builder.pickOnScreenshot')}
            </button>
            <span className="text-muted">{t('builder.or')}</span>
            <input
              ref={inputRef}
              className="input flex-1"
              placeholder={t('builder.targetPlaceholder')}
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && target) handleExecute(); }}
              disabled={executing}
            />
          </>
        );
      case 'verify':
        return (
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder={t('builder.targetPlaceholder')}
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && target) handleExecute(); }}
            disabled={executing}
          />
        );
      case 'type':
        return (
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder={t('builder.textPlaceholder')}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && text) handleExecute(); }}
            disabled={executing}
          />
        );
      case 'press_key':
        return (
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder={t('builder.keyPlaceholder')}
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && key) handleExecute(); }}
            disabled={executing}
          />
        );
      case 'hotkey':
        return (
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder={t('builder.keysPlaceholder')}
            value={keys}
            onChange={e => setKeys(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && keys) handleExecute(); }}
            disabled={executing}
          />
        );
      case 'scroll':
        return (
          <input
            className="input"
            type="number"
            value={scrollAmount}
            onChange={e => setScrollAmount(parseInt(e.target.value) || 0)}
            style={{ width: 100 }}
            disabled={executing}
          />
        );
      case 'wait':
        return (
          <input
            className="input"
            type="number"
            step="0.5"
            value={waitSeconds}
            onChange={e => setWaitSeconds(parseFloat(e.target.value) || 0)}
            style={{ width: 100 }}
            disabled={executing}
          />
        );
      case 'launch_application':
        return (
          <>
            <AppPathInput
              value={appPath}
              onChange={setAppPath}
              placeholder={t('builder.appPathPlaceholder')}
              disabled={executing}
              onKeyDown={e => { if (e.key === 'Enter' && appPath) handleExecute(); }}
            />
          </>
        );
      case 'set_variable':
        return (
          <>
            <input
              ref={inputRef}
              className="input"
              placeholder={t('stepForm.variableNamePlaceholder')}
              value={variableName}
              onChange={e => setVariableName(e.target.value)}
              disabled={executing}
              style={{ width: 150 }}
            />
            <input
              className="input flex-1"
              placeholder={t('stepForm.variableValuePlaceholder')}
              value={variableValue}
              onChange={e => setVariableValue(e.target.value)}
              disabled={executing}
            />
          </>
        );
      case 'loop':
        return (
          <>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('stepForm.loopTargetPlaceholder')}
              <input
                className="input"
                type="number"
                min="1"
                value={loopTarget}
                onChange={e => setLoopTarget(parseInt(e.target.value) || 1)}
                disabled={executing}
                style={{ width: 60 }}
              />
            </label>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('stepForm.repeatPlaceholder')}
              <input
                className="input"
                type="number"
                min="1"
                value={repeatCount}
                onChange={e => setRepeatCount(parseInt(e.target.value) || 1)}
                disabled={executing}
                style={{ width: 60 }}
              />
            </label>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="builder-page">
      <div className="section-header">
        <div className="header-actions-left">
          <h2>{t('builder.title')}</h2>
          {!active ? (
            <button className="btn btn-primary" onClick={handleStart} disabled={loading}>
              <Play size={16} />{loading ? t('builder.starting') : t('builder.start')}
            </button>
          ) : (
            <>
              {steps.length > 0 && (
                <button className="btn btn-success" onClick={handleSaveAsTest}>
                  <Save size={16} />{t('builder.saveAsTest')}
                </button>
              )}
              <button className="btn btn-danger" onClick={handleStop}>
                <Square size={16} />{t('builder.stop')}
              </button>
            </>
          )}
        </div>
      </div>

      {!active && !loading && (
        <div className="empty-state">
          <p>{t('builder.instructions')}</p>
        </div>
      )}

      {loading && (
        <div className="info-banner">{t('builder.loadingModel')}</div>
      )}

      {/* Confirm/retry bar for pending steps */}
      {active && pendingStep && (
        <div className="builder-confirm-bar">
          <div className="builder-confirm-info">
            <span>{pendingStep.step.step.click_x != null ? t('builder.confirmClickPrompt') : t('builder.confirmPrompt')}</span>
            {pendingStep.step.coordinates && (
              <span className="text-muted">
                Clicked at ({pendingStep.step.coordinates.join(', ')})
              </span>
            )}
          </div>
          <div className="builder-confirm-actions">
            <button className="btn btn-success btn-sm" onClick={acceptPendingStep}>
              {t('builder.accept')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={retryPendingStep}>
              {t('builder.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Command input bar — at the top for easy access */}
      {active && !pendingStep && (
        <div className="builder-input-bar">
          <select
            className="input"
            value={action}
            onChange={e => setAction(e.target.value)}
            style={{ width: 160 }}
            disabled={executing}
          >
            {stepTypes.map(st => (
              <option key={st.name} value={st.name}>{st.name}</option>
            ))}
          </select>
          {renderFieldsForAction()}
          <input
            className="input builder-desc-input"
            placeholder={t('builder.descriptionPlaceholder')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={executing}
          />
          <div className="builder-run-split" ref={runMenuRef}>
            <button className="btn btn-primary" onClick={handleExecute} disabled={executing}>
              <Play size={16} />{executing ? t('builder.executing') : t('builder.addAndRun')}
            </button>
            <button
              className="btn btn-primary builder-run-toggle"
              onClick={() => setShowRunMenu(!showRunMenu)}
              disabled={executing}
            >
              <ChevronDown size={14} />
            </button>
            {showRunMenu && (
              <div className="builder-run-dropdown">
                <button className="builder-run-dropdown-item" onClick={() => { handleSaveStep(); setShowRunMenu(false); }}>
                  <Check size={14} />{t('builder.addOnly')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags and Variables */}
      {active && (
        <BuilderMetadata tags={tags} onTagsChange={setTags} variables={variables} onVariablesChange={setVariables} />
      )}

      {active && (
        <div className="builder-layout">
          {/* Step list */}
          <div className="builder-steps">
            {steps.length === 0 ? (
              <p className="text-muted" style={{ padding: '0.5rem' }}>{t('builder.noSteps')}</p>
            ) : (
              steps.map((s, i) => (
                <div key={i}>
                  <div
                    className={`builder-step-item ${selectedStep === i ? 'selected' : ''}`}
                    onClick={() => setSelectedStep(selectedStep === i ? null : i)}
                  >
                    <span className="step-num">#{i + 1}</span>
                    <span className="step-label">
                      <strong>{s.step.action}</strong>
                      {s.step.target && <> &mdash; {s.step.target}</>}
                      {s.step.text && <> &mdash; "{s.step.text}"</>}
                      {s.step.app_path && <> &mdash; {s.step.app_path}</>}
                    </span>
                    <StatusBadge passed={s.passed} />
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setExpandedStep(expandedStep === i ? null : i); }} title={t('builder.expandDetails')}>
                      {expandedStep === i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleRemoveStep(i); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {expandedStep === i && (
                    <StepDetail step={s} index={i} onChange={handleUpdateStep} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Screenshot */}
          <div className="builder-screenshot">
            <div className="builder-screenshot-toolbar">
              <button className="btn btn-secondary btn-sm" onClick={handleCapture}>
                <Camera size={14} />{t('builder.refreshView')}
              </button>
            </div>
            {pickMode && (
              <div className="builder-pick-banner">
                <span>{t('builder.pickInstruction')}</span>
                <button className="btn btn-sm" onClick={() => setPickMode(false)} style={{ marginLeft: 'auto', color: '#2563eb', background: 'none', border: '1px solid #bfdbfe' }}>
                  {t('builder.cancelPick')}
                </button>
              </div>
            )}
            {displayedScreenshot ? (
              <img
                ref={screenshotRef}
                src={`data:image/png;base64,${displayedScreenshot}`}
                alt="Current screen"
                className={`screenshot-img${pickMode ? ' screenshot-pickable' : ''}`}
                onClick={handleScreenshotClick}
              />
            ) : (
              <div className="screenshot-placeholder">
                <p>{t('builder.screenshotPlaceholder')}</p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

function BuilderMetadata({ tags, onTagsChange, variables, onVariablesChange }: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  variables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const commitTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setNewTag('');
    setAdding(false);
  };

  return (
    <div className="builder-metadata">
      <button className="builder-metadata-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {t('builder.tagsAndVariables')}
        {(tags.length > 0 || Object.keys(variables).length > 0) && (
          <span className="console-count">{tags.length + Object.keys(variables).length}</span>
        )}
      </button>
      {expanded && (
        <div className="builder-metadata-content">
          <div className="form-group">
            <label>{t('testEditor.tags')}</label>
            <div className="tags-input">
              {tags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button className="tag-chip-remove" onClick={() => onTagsChange(tags.filter(t => t !== tag))}>&times;</button>
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
          <div className="form-group">
            <label>{t('testEditor.variables')}</label>
            <VariablesEditor variables={variables} onChange={onVariablesChange} />
          </div>
        </div>
      )}
    </div>
  );
}

function StepDetail({ step, index, onChange }: {
  step: BuilderStep;
  index: number;
  onChange: (index: number, updated: BuilderStep) => void;
}) {
  const { t } = useTranslation();
  const s = step.step;

  const updateField = (field: string, value: unknown) => {
    onChange(index, {
      ...step,
      step: { ...s, [field]: value },
    });
  };

  return (
    <div className="builder-step-detail">
      <div className="builder-detail-header">
        <strong>#{index + 1} {s.action}</strong>
        {step.duration_seconds > 0 && (
          <span className="text-muted">{step.duration_seconds.toFixed(1)}s</span>
        )}
      </div>

      <div className="builder-detail-row">
        <span className="builder-detail-label">{t('builder.detail.description')}</span>
        <input
          className="input builder-detail-input"
          value={s.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder={t('builder.descriptionPlaceholder')}
        />
      </div>

      {(s.action === 'click' || s.action === 'double_click' || s.action === 'right_click' || s.action === 'verify') && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.target')}</span>
          <input
            className="input builder-detail-input"
            value={s.target ?? ''}
            onChange={e => updateField('target', e.target.value || null)}
            placeholder="Target element"
          />
        </div>
      )}

      {s.action === 'type' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.text')}</span>
          <input
            className="input builder-detail-input"
            value={s.text ?? ''}
            onChange={e => updateField('text', e.target.value || null)}
          />
        </div>
      )}

      {s.action === 'press_key' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.key')}</span>
          <input
            className="input builder-detail-input"
            value={s.key ?? ''}
            onChange={e => updateField('key', e.target.value || null)}
          />
        </div>
      )}

      {s.action === 'hotkey' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.keys')}</span>
          <input
            className="input builder-detail-input"
            value={s.keys?.join(', ') ?? ''}
            onChange={e => updateField('keys', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
          />
        </div>
      )}

      {s.action === 'scroll' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.scrollAmount')}</span>
          <input
            className="input builder-detail-input"
            type="number"
            value={s.scroll_amount}
            onChange={e => updateField('scroll_amount', parseInt(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        </div>
      )}

      {(s.action === 'wait' || s.action === 'launch_application') && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.waitSeconds')}</span>
          <input
            className="input builder-detail-input"
            type="number"
            step="0.5"
            value={s.wait_seconds}
            onChange={e => updateField('wait_seconds', parseFloat(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        </div>
      )}

      {s.action === 'launch_application' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.appPath')}</span>
          <input
            className="input builder-detail-input"
            value={s.app_path ?? ''}
            onChange={e => updateField('app_path', e.target.value || null)}
          />
        </div>
      )}

      {s.click_x != null && s.click_y != null && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.clickCoords')}</span>
          <span className="text-muted">({Math.round(s.click_x * 100)}%, {Math.round(s.click_y * 100)}%)</span>
        </div>
      )}

      {step.coordinates && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.pixelCoords')}</span>
          <span className="text-muted">({step.coordinates.join(', ')})</span>
        </div>
      )}

      {step.error && (
        <div className="builder-detail-row builder-step-error">
          <span className="builder-detail-label">{t('builder.detail.error')}</span> {step.error}
        </div>
      )}
    </div>
  );
}
