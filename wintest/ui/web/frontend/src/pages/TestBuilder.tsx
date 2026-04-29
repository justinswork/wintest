import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Trash2, Save, Square, Plus, ChevronDown, ChevronRight, Camera, FolderOpen } from 'lucide-react';
import { builderApi, baselineApi, fileApi } from '../api/client';
import { AppPathInput } from '../components/common/AppPathInput';
import { VariablesEditor } from '../components/tasks/VariablesEditor';
import { useTestStore } from '../stores/testStore';
import { showToast } from '../components/common/Toast';
import { StatusBadge } from '../components/common/StatusBadge';
import { KeyRecorder } from '../components/common/KeyRecorder';
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
  const [clickType, setClickType] = useState('click');
  const [target, setTarget] = useState('');
  const [text, setText] = useState('');
  const [key, setKey] = useState('');
  const [keys, setKeys] = useState('');
  const [scrollAmount, setScrollAmount] = useState(3);
  const [waitSeconds, setWaitSeconds] = useState(1);
  const [appPath, setAppPath] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [description, setDescription] = useState('');
  const [regionMode, setRegionMode] = useState(false);
  const regionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [regionRect, setRegionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.90);
  const [filePath, setFilePath] = useState('');
  const [compareMode, setCompareMode] = useState('exact');
  const [watchingDir, setWatchingDir] = useState<{ stepIndex: number; dir: string; snapshot: Record<string, number> } | null>(null);
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
      setWatchingDir(null);
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
    setFilePath('');
    setCompareMode('exact');
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
    if (steps.length > 0 && !window.confirm(t('builder.confirmStop'))) return;
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
    if (regionMode) return; // Don't handle clicks during region selection
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
        action: 'click',
        description: description || `${clickType} at (${Math.round(clickX * 100)}%, ${Math.round(clickY * 100)}%)`,
        click_x: clickX,
        click_y: clickY,
        click_type: clickType,
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

      // Coordinate clicks are accepted immediately — no confirmation needed
      setSteps(prev => [...prev, builderStep]);
      setSelectedStep(null);
      // Reset for next step
      setAction('click');
      setTarget('');
      setDescription('');
      setVariableName('');
      setVariableValue('');
      setLoopTarget(1);
      setRepeatCount(1);
      setFilePath('');
      setCompareMode('exact');

      // Auto-continue pick mode: use the post-click screenshot so the user
      // can immediately click the next target without pressing the button again.
      const nextScreenshot = result.post_screenshot_base64 ?? result.screenshot_base64 ?? null;
      setScreenshot(nextScreenshot);
      if (nextScreenshot) {
        setPickMode(true);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Step failed';
      showToast(msg, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleStartRegionSelect = async () => {
    try {
      const res = await builderApi.screenshot();
      setScreenshot(res.screenshot_base64);
      setSelectedStep(null);
      setRegionMode(true);
      setRegionRect(null);
      regionStartRef.current = null;
      setDragging(false);
    } catch {
      showToast(t('builder.captureFailed'), 'error');
    }
  };

  const handleRegionMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!regionMode) return;
    e.preventDefault();
    const img = screenshotRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const start = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    regionStartRef.current = start;
    setDragging(true);
    setRegionRect(null);
  };

  const handleRegionMouseMove = (e: React.MouseEvent) => {
    if (!regionMode || !dragging || !regionStartRef.current) return;
    e.preventDefault();
    const img = screenshotRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const start = regionStartRef.current;
    setRegionRect({
      x1: Math.min(start.x, x),
      y1: Math.min(start.y, y),
      x2: Math.max(start.x, x),
      y2: Math.max(start.y, y),
    });
  };

  const handleRegionMouseUp = () => {
    if (!regionMode || !dragging) return;
    regionStartRef.current = null;
    setDragging(false);
  };

  const handleSaveBaseline = async () => {
    if (!regionRect || !screenshot) return;
    setExecuting(true);
    try {
      // Create a canvas to crop the region from the screenshot
      const img = new window.Image();
      img.src = `data:image/png;base64,${screenshot}`;
      await new Promise(resolve => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      const sx = Math.round(regionRect.x1 * img.width);
      const sy = Math.round(regionRect.y1 * img.height);
      const sw = Math.round((regionRect.x2 - regionRect.x1) * img.width);
      const sh = Math.round((regionRect.y2 - regionRect.y1) * img.height);
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const croppedBase64 = canvas.toDataURL('image/png').split(',')[1];
      const baselineName = description || `baseline_step${steps.length + 1}`;
      const result = await baselineApi.save(croppedBase64, baselineName);

      // Add the verify_screenshot step
      const stepData: Record<string, unknown> = {
        action: 'verify_screenshot',
        description: description || `Verify region matches baseline`,
        baseline_id: result.baseline_id,
        region: [regionRect.x1, regionRect.y1, regionRect.x2, regionRect.y2],
        similarity_threshold: similarityThreshold,
      };
      const builderStep: BuilderStep = {
        step: buildStepRecord(stepData),
        passed: true,
        error: null,
        coordinates: null,
        model_response: null,
        duration_seconds: 0,
        screenshot_base64: screenshot,
      };
      setSteps(prev => [...prev, builderStep]);
      setRegionMode(false);
      setRegionRect(null);
      setDescription('');
      showToast(t('builder.baselineSaved'));
    } catch {
      showToast(t('builder.baselineSaveFailed'), 'error');
    } finally {
      setExecuting(false);
    }
  };

  const buildStepFromForm = (): Record<string, unknown> => {
    const step: Record<string, unknown> = { action, description: description || undefined };
    switch (action) {
      case 'click':
        // Coordinate-based click — coords are set by the screenshot pick flow,
        // not from the input bar.
        step.click_type = clickType;
        break;
      case 'click_element':
        step.target = target;
        step.click_type = clickType;
        break;
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
      case 'verify_screenshot':
        // Handled separately via handleSaveBaseline
        break;
      case 'compare_saved_file':
        step.file_path = filePath;
        step.compare_mode = compareMode;
        step.similarity_threshold = similarityThreshold;
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
    // Clear input fields for the next step but keep the user's chosen action.
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
    setFilePath('');
    setCompareMode('exact');
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

  const handleCaptureBaseline = async (stepIndex: number) => {
    const s = steps[stepIndex];
    if (!s.step.file_path) return;

    try {
      const detected = await builderApi.detectNewFile(s.step.file_path, {});
      if (!detected.new_files || detected.new_files.length === 0) {
        showToast(t('builder.noNewFile'), 'error');
        return;
      }

      const newest = detected.new_files.sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime)[0];
      const baselineName = s.step.description || `file_baseline_step${stepIndex + 1}`;
      const result = await baselineApi.saveFromFile(newest.path, baselineName);

      setSteps(prev => prev.map((step, i) =>
        i === stepIndex
          ? { ...step, step: { ...step.step, baseline_id: result.baseline_id }, model_response: `Baseline: ${newest.name}` }
          : step
      ));
      showToast(`${t('builder.baselineSaved')} — ${newest.name}`);
    } catch {
      showToast(t('builder.baselineSaveFailed'), 'error');
    }
  };

  const handleSaveStep = async () => {
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
    const newIndex = steps.length;
    setSteps(prev => [...prev, builderStep]);
    setSelectedStep(newIndex);

    // Start watching directory if this is a compare_saved_file step without a baseline
    if (action === 'compare_saved_file' && filePath && !stepData.baseline_id) {
      try {
        // Snapshot current directory contents
        const detected = await builderApi.detectNewFile(filePath, {});
        const currentSnapshot: Record<string, number> = {};
        for (const f of detected.new_files || []) {
          currentSnapshot[f.name] = f.mtime;
        }
        setWatchingDir({ stepIndex: newIndex, dir: filePath, snapshot: currentSnapshot });
      } catch { /* ignore */ }
    }

    // Clear input fields for the next step but keep the user's chosen action.
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
    setFilePath('');
    setCompareMode('exact');
  };

  const handleExecute = async () => {
    // For file comparison steps, redirect to save flow

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

        // Clear input fields but keep the user's chosen action.
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
        setFilePath('');
        setCompareMode('exact');
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

  // Directory watcher: poll for new files when a compare_saved_file step has no baseline
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!watchingDir) return;
    const { stepIndex, dir, snapshot } = watchingDir;

    const interval = setInterval(async () => {
      // Check if step still exists and still needs a baseline
      const currentSteps = stepsRef.current;
      if (stepIndex >= currentSteps.length || currentSteps[stepIndex]?.step.baseline_id) {
        setWatchingDir(null);
        return;
      }

      try {
        const detected = await builderApi.detectNewFile(dir, snapshot);
        if (detected.new_files && detected.new_files.length > 0) {
          const newest = detected.new_files.sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime)[0];
          const baselineName = currentSteps[stepIndex]?.step.description || `file_baseline_step${stepIndex + 1}`;
          const result = await baselineApi.saveFromFile(newest.path, baselineName);

          setSteps(prev => prev.map((s, i) =>
            i === stepIndex
              ? { ...s, step: { ...s.step, baseline_id: result.baseline_id }, model_response: `Baseline: ${newest.name}` }
              : s
          ));
          setWatchingDir(null);
          showToast(`${t('builder.baselineSaved')} — ${newest.name}`);
        }
      } catch { /* polling error — ignore and retry */ }
    }, 2000);

    return () => clearInterval(interval);
  }, [watchingDir]);

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
    // Stop watcher if this step was being watched
    if (watchingDir?.stepIndex === index) setWatchingDir(null);
    else if (watchingDir && watchingDir.stepIndex > index) {
      setWatchingDir({ ...watchingDir, stepIndex: watchingDir.stepIndex - 1 });
    }
  };

  const handleUpdateStep = (index: number, updated: BuilderStep) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const handleSaveAsTest = async () => {
    // Check for compare_saved_file steps without baselines
    const missingBaseline = steps.find(s => s.step.action === 'compare_saved_file' && !s.step.baseline_id);
    if (missingBaseline) {
      showToast(t('builder.missingBaseline'), 'error');
      return;
    }

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
        return (
          <>
            <select
              className="input"
              value={clickType}
              onChange={e => setClickType(e.target.value)}
              disabled={executing}
              style={{ width: 'auto' }}
            >
              <option value="click">{t('builder.clickLeft')}</option>
              <option value="double_click">{t('builder.clickDouble')}</option>
              <option value="right_click">{t('builder.clickRight')}</option>
              <option value="middle_click">{t('builder.clickMiddle')}</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={handleStartPick}
              disabled={executing || pickMode}
            >
              {t('builder.pickOnScreenshot')}
            </button>
          </>
        );
      case 'click_element':
        return (
          <>
            <select
              className="input"
              value={clickType}
              onChange={e => setClickType(e.target.value)}
              disabled={executing}
              style={{ width: 'auto' }}
            >
              <option value="click">{t('builder.clickLeft')}</option>
              <option value="double_click">{t('builder.clickDouble')}</option>
              <option value="right_click">{t('builder.clickRight')}</option>
              <option value="middle_click">{t('builder.clickMiddle')}</option>
            </select>
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
          <KeyRecorder
            inputRef={inputRef}
            mode="single"
            value={key}
            onChange={setKey}
            placeholder={t('builder.keyPlaceholder')}
            disabled={executing}
            onEnter={handleExecute}
          />
        );
      case 'hotkey':
        return (
          <KeyRecorder
            inputRef={inputRef}
            mode="combo"
            value={keys}
            onChange={setKeys}
            placeholder={t('builder.keysPlaceholder')}
            disabled={executing}
            onEnter={handleExecute}
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
          <>
            <input
              className="input"
              type="number"
              step="0.5"
              value={waitSeconds}
              onChange={e => setWaitSeconds(parseFloat(e.target.value) || 0)}
              style={{ width: 100 }}
              disabled={executing}
            />
            <span className="text-muted">{t('builder.seconds')}</span>
          </>
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
      case 'verify_screenshot':
        return (
          <>
            <button
              className="btn btn-primary"
              onClick={handleStartRegionSelect}
              disabled={executing || regionMode}
            >
              {t('builder.selectRegion')}
            </button>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('builder.threshold')}
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={similarityThreshold}
                onChange={e => setSimilarityThreshold(parseFloat(e.target.value) || 0.95)}
                disabled={executing}
                style={{ width: 70 }}
              />
            </label>
          </>
        );
      case 'compare_saved_file':
        return (
          <>
            <input
              ref={inputRef}
              className="input flex-1"
              placeholder={t('builder.watchDirPlaceholder')}
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              disabled={executing}
            />
            <button
              className="btn-icon"
              onClick={async () => {
                try { setFilePath(await fileApi.pickFolder()); } catch { /* cancelled */ }
              }}
              disabled={executing}
              title={t('appPath.browse')}
            >
              <FolderOpen size={16} />
            </button>
            <select
              className="input"
              value={compareMode}
              onChange={e => setCompareMode(e.target.value)}
              disabled={executing}
              style={{ width: 'auto' }}
            >
              <option value="exact">{t('builder.modeExact')}</option>
              <option value="image">{t('builder.modeImage')}</option>
            </select>
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
            onChange={e => {
              setAction(e.target.value);
              // Cancel any in-progress screenshot pick / region drag — they
              // belong to a different step type than the user just selected.
              setPickMode(false);
              setRegionMode(false);
              setRegionRect(null);
              regionStartRef.current = null;
            }}
            style={{ width: 200 }}
            disabled={executing}
          >
            {[...stepTypes]
              .sort((a, b) => Number(a.requires_vision) - Number(b.requires_vision))
              .map(st => (
                <option key={st.name} value={st.name}>
                  {st.requires_vision ? `✨ ${st.label}` : st.label}
                </option>
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
          {(() => {
            // Steps where the entire add flow happens via a picker on the
            // screenshot (coordinate click, verify_screenshot region) — the
            // Add buttons aren't applicable.
            if (action === 'click' || action === 'verify_screenshot') {
              return null;
            }

            const interactive = ['click_element', 'type', 'launch_application'].includes(action);
            const primaryAction = interactive ? handleExecute : handleSaveStep;
            const primaryLabel = interactive
              ? (executing ? t('builder.executing') : t('builder.addAndRun'))
              : t('builder.addStep');
            const primaryIcon = interactive ? <Play size={16} /> : <Plus size={16} />;
            const secondaryAction = interactive ? handleSaveStep : handleExecute;
            const secondaryLabel = interactive ? t('builder.addOnly') : t('builder.addAndRun');
            const secondaryIcon = interactive ? <Plus size={14} /> : <Play size={14} />;

            // Gate the Add buttons on the form having the required input for
            // this action. Avoids triggering AI model loads for empty steps.
            const formReady = (() => {
              switch (action) {
                case 'click_element': return target.trim().length > 0;
                case 'verify': return target.trim().length > 0;
                case 'type': return text.length > 0;
                case 'press_key': return key.trim().length > 0;
                case 'hotkey': return keys.trim().length > 0;
                case 'launch_application': return appPath.trim().length > 0;
                case 'set_variable': return variableName.trim().length > 0;
                case 'compare_saved_file': return filePath.trim().length > 0;
                case 'scroll': return scrollAmount !== 0;
                case 'wait': return waitSeconds > 0;
                case 'loop': return loopTarget >= 1 && repeatCount >= 1;
                default: return true;
              }
            })();
            const buttonsDisabled = executing || !formReady;

            return (
              <div className="builder-run-split" ref={runMenuRef}>
                <button className="btn btn-primary" onClick={primaryAction} disabled={buttonsDisabled}>
                  {primaryIcon}{primaryLabel}
                </button>
                <button
                  className="btn btn-primary builder-run-toggle"
                  onClick={() => setShowRunMenu(!showRunMenu)}
                  disabled={buttonsDisabled}
                >
                  <ChevronDown size={14} />
                </button>
                {showRunMenu && (
                  <div className="builder-run-dropdown">
                    <button className="builder-run-dropdown-item" onClick={() => { secondaryAction(); setShowRunMenu(false); }}>
                      {secondaryIcon}{secondaryLabel}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tags and Variables */}
      {active && (
        <BuilderMetadata tags={tags} onTagsChange={setTags} variables={variables} onVariablesChange={setVariables} />
      )}

      {active && watchingDir && (
        <div className="builder-watching-banner">
          <span className="builder-watching-dot" />
          {t('builder.watchingDirectory', { dir: watchingDir.dir })}
        </div>
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
                      <strong>
                        {(s.step.action === 'click' || s.step.action === 'click_element')
                            && s.step.click_type && s.step.click_type !== 'click'
                          ? s.step.click_type
                          : s.step.action}
                      </strong>
                      {s.step.target && <> &mdash; {s.step.target}</>}
                      {s.step.text && <> &mdash; "{s.step.text}"</>}
                      {s.step.app_path && <> &mdash; {s.step.app_path}</>}
                    </span>
                    {s.step.action === 'compare_saved_file' && (
                      <span className={`badge-sm ${s.step.baseline_id ? 'badge-pass' : 'badge-fail'}`} title={s.step.baseline_id || t('builder.noBaselineYet')}>
                        {s.step.baseline_id ? t('builder.baselineReady') : t('builder.waiting')}
                      </span>
                    )}
                    {s.step.action !== 'compare_saved_file' && <StatusBadge passed={s.passed} />}
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setExpandedStep(expandedStep === i ? null : i); }} title={t('builder.expandDetails')}>
                      {expandedStep === i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleRemoveStep(i); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {expandedStep === i && (
                    <StepDetail step={s} index={i} onChange={handleUpdateStep} onCaptureBaseline={handleCaptureBaseline} />
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
            {regionMode && (
              <div className="builder-pick-banner" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#22c55e' }}>
                <span>{regionRect ? t('builder.regionConfirm') : t('builder.regionInstruction')}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                  {regionRect && (
                    <button className="btn btn-success btn-sm" onClick={handleSaveBaseline} disabled={executing}>
                      {t('builder.saveBaseline')}
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => { setRegionMode(false); setRegionRect(null); }} style={{ color: '#166534', background: 'none', border: '1px solid #bbf7d0' }}>
                    {t('builder.cancelPick')}
                  </button>
                </div>
              </div>
            )}
            <div
              className="builder-screenshot-container"
              onMouseMove={handleRegionMouseMove}
              onMouseUp={handleRegionMouseUp}
            >
              {displayedScreenshot ? (
                <>
                  <img
                    ref={screenshotRef}
                    src={`data:image/png;base64,${displayedScreenshot}`}
                    alt="Current screen"
                    className={`screenshot-img${pickMode ? ' screenshot-pickable' : ''}${regionMode ? ' screenshot-region-select' : ''}`}
                    onClick={handleScreenshotClick}
                    onMouseDown={handleRegionMouseDown}
                    draggable={false}
                  />
                  {regionRect && (
                    <div
                      className="region-overlay"
                      style={{
                        left: `${regionRect.x1 * 100}%`,
                        top: `${regionRect.y1 * 100}%`,
                        width: `${(regionRect.x2 - regionRect.x1) * 100}%`,
                        height: `${(regionRect.y2 - regionRect.y1) * 100}%`,
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="screenshot-placeholder">
                  <p>{t('builder.screenshotPlaceholder')}</p>
                </div>
              )}
            </div>

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

function StepDetail({ step, index, onChange, onCaptureBaseline }: {
  step: BuilderStep;
  index: number;
  onChange: (index: number, updated: BuilderStep) => void;
  onCaptureBaseline?: (index: number) => void;
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
        <strong>
          #{index + 1}{' '}
          {(s.action === 'click' || s.action === 'click_element')
              && s.click_type && s.click_type !== 'click'
            ? s.click_type
            : s.action}
        </strong>
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

      {(s.action === 'click_element' || s.action === 'verify') && (
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
          <KeyRecorder
            mode="single"
            className="input builder-detail-input"
            value={s.key ?? ''}
            onChange={v => updateField('key', v || null)}
          />
        </div>
      )}

      {s.action === 'hotkey' && (
        <div className="builder-detail-row">
          <span className="builder-detail-label">{t('builder.detail.keys')}</span>
          <KeyRecorder
            mode="combo"
            className="input builder-detail-input"
            value={s.keys?.join(', ') ?? ''}
            onChange={v => updateField('keys', v.split(',').map(k => k.trim()).filter(Boolean))}
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

      {s.action === 'compare_saved_file' && onCaptureBaseline && (
        <div className="builder-detail-row" style={{ marginTop: '0.5rem' }}>
          {s.baseline_id ? (
            <span className="text-muted">{t('builder.detail.baselineSet')}: {s.baseline_id}</span>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => onCaptureBaseline(index)}>
              {t('builder.captureBaseline')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
