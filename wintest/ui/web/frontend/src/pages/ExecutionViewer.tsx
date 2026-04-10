import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpNarrowWide, ArrowDownNarrowWide, XCircle, RotateCcw, Terminal, ChevronDown, ChevronRight, ClipboardCopy, Download, FlaskConical, FolderOpen } from 'lucide-react';
import { reportApi } from '../api/client';
import { useExecutionStore } from '../stores/executionStore';
import { useTestStore } from '../stores/testStore';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { useExecutionWebSocket } from '../api/ws';
import { StatusBadge } from '../components/common/StatusBadge';

const STATUS_KEYS: Record<string, string> = {
  idle: 'execution.idle',
  running: 'execution.running',
  completed: 'execution.completed',
  failed: 'execution.failed',
  cancelled: 'execution.cancelled',
};

const SORT_STORAGE_KEY = 'wintest-execution-sort';

export function ExecutionViewer() {
  const { t } = useTranslation();
  const store = useExecutionStore();
  const { handleWsMessage, fetchStatus } = store;
  const [sortNewestFirst, setSortNewestFirst] = useState(() => localStorage.getItem(SORT_STORAGE_KEY) !== 'asc');

  useExecutionWebSocket(handleWsMessage);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleSort = () => {
    const next = !sortNewestFirst;
    setSortNewestFirst(next);
    localStorage.setItem(SORT_STORAGE_KEY, next ? 'desc' : 'asc');
  };

  const sortedResults = sortNewestFirst ? [...store.stepResults].reverse() : store.stepResults;

  const hasFailed = store.stepResults.some(r => !r.passed);
  const isComplete = store.status === 'completed' || store.status === 'failed' || store.status === 'cancelled';
  const progressClass = isComplete
    ? (hasFailed ? 'progress-failed' : 'progress-passed')
    : (hasFailed ? 'progress-warning' : '');

  const latestScreenshot = store.stepResults.length > 0
    ? store.stepResults[store.stepResults.length - 1]?.screenshot_base64
    : null;

  const handleRunAgain = () => {
    if (!store.sourceFile) return;
    if (store.runType === 'suite') {
      store.startSuiteRun(store.sourceFile);
    } else {
      store.startRun(store.sourceFile);
    }
  };

  return (
    <div className="execution-viewer">
      <div className="section-header">
        <h2>{store.testName ? t('execution.titleWithTask', { name: store.testName }) : t('execution.title')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {store.status === 'running' && (
            <button className="btn btn-danger" onClick={() => store.cancelRun()}>
              <XCircle size={16} />{t('execution.cancel')}
            </button>
          )}
          {isComplete && store.sourceFile && (
            <button className="btn btn-primary" onClick={handleRunAgain}>
              <RotateCcw size={16} />{t('execution.runAgain')}
            </button>
          )}
          <span className={`execution-status status-${store.status}`}>
            {t(STATUS_KEYS[store.status] ?? 'execution.idle')}
          </span>
        </div>
      </div>

      {store.modelStatus === 'loading' && (
        <div className="info-banner">{t('execution.modelLoading')}</div>
      )}

      {store.error && (
        <div className="error-banner">{store.error}</div>
      )}

      {store.status === 'idle' && !store.runId && (
        <RunPicker />
      )}

      <div className="execution-layout">
        <div className="step-list-panel">
          {store.totalSteps > 0 && (
            <div className="step-list-toolbar">
              <div className="progress-bar-container" style={{ flex: 1 }}>
                <div
                  className={`progress-bar ${progressClass}`}
                  style={{ width: `${(store.stepResults.length / store.totalSteps) * 100}%` }}
                />
                <span className="progress-text">
                  {store.stepResults.length} / {store.totalSteps}
                </span>
              </div>
              <button
                className="btn-icon"
                onClick={toggleSort}
                title={t(sortNewestFirst ? 'execution.sortOldestFirst' : 'execution.sortNewestFirst')}
              >
                {sortNewestFirst ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
              </button>
            </div>
          )}

          {store.currentLabel && store.status === 'running' && store.currentStep > store.stepResults.length && (
            <div className="step-card step-running">
              <span className="step-num">#{store.currentStep}</span>
              <span className="step-label">{store.currentLabel}</span>
              <span className="step-status">{t('execution.stepRunning')}</span>
            </div>
          )}

          {sortedResults.map((result) => (
            <div
              key={result.step_num}
              className={`step-card ${result.passed ? 'step-passed' : 'step-failed'}`}
            >
              <div className="step-card-header">
                <span className="step-num">#{result.step_num}</span>
                <span className="step-label">{result.description || result.action}</span>
                <StatusBadge passed={result.passed} />
                <span className="step-duration">{result.duration_seconds.toFixed(1)}s</span>
              </div>
              {result.error && <p className="step-error">{result.error}</p>}
              {result.coordinates && (
                <p className="step-coords">{t('execution.clickedAt', { coords: result.coordinates.join(', ') })}</p>
              )}
            </div>
          ))}
        </div>

        <div className="screenshot-panel">
          {latestScreenshot ? (
            <img
              src={`data:image/png;base64,${latestScreenshot}`}
              alt={t('execution.screenshotAlt')}
              className="screenshot-img"
            />
          ) : (
            <div className="screenshot-placeholder">
              <p>{t('execution.screenshotPlaceholder')}</p>
            </div>
          )}
        </div>
      </div>

      <ConsolePanel />
    </div>
  );
}

function RunPicker() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tests, fetchTests } = useTestStore();
  const { testSuites, fetchTestSuites } = useTestSuiteStore();
  const { startRun, startSuiteRun } = useExecutionStore();
  const [recentNames, setRecentNames] = useState<string[]>([]);

  useEffect(() => {
    fetchTests();
    fetchTestSuites();
    // Get recent test names from reports
    reportApi.list().then(reports => {
      const seen = new Set<string>();
      const names: string[] = [];
      for (const r of reports) {
        if (!seen.has(r.test_name)) {
          seen.add(r.test_name);
          names.push(r.test_name);
        }
        if (names.length >= 5) break;
      }
      setRecentNames(names);
    });
  }, [fetchTests, fetchTestSuites]);

  const MAX_ITEMS = 5;

  // Build a unified list: recent runs first, then remaining tests/suites
  type RunItem = { type: 'test' | 'suite'; name: string; filename: string; detail: string };

  const recentItems: RunItem[] = recentNames
    .map(name => {
      const test = tests.find(t => t.name === name);
      if (test) return { type: 'test' as const, name: test.name, filename: test.filename, detail: `${test.step_count} steps` };
      const suite = testSuites.find(s => s.name === name);
      if (suite) return { type: 'suite' as const, name: suite.name, filename: suite.filename, detail: `${suite.test_count} tests` };
      return null;
    })
    .filter(Boolean) as RunItem[];

  const recentFilenames = new Set(recentItems.map(i => i.filename));
  const otherItems: RunItem[] = [
    ...tests.filter(t => !recentFilenames.has(t.filename)).map(t => ({
      type: 'test' as const, name: t.name, filename: t.filename, detail: `${t.step_count} steps`,
    })),
    ...testSuites.filter(s => !recentFilenames.has(s.filename)).map(s => ({
      type: 'suite' as const, name: s.name, filename: s.filename, detail: `${s.test_count} tests`,
    })),
  ];

  const allItems = [...recentItems, ...otherItems];
  const displayItems = allItems.slice(0, MAX_ITEMS);
  const totalCount = tests.length + testSuites.length;

  if (totalCount === 0) {
    return (
      <div className="run-picker">
        <p className="empty-state">{t('execution.noTests')}</p>
        <button className="btn btn-primary" onClick={() => navigate('/tests/new')} style={{ marginTop: '0.5rem' }}>
          {t('execution.createTest')}
        </button>
      </div>
    );
  }

  const handleRun = (item: RunItem) => {
    if (item.type === 'suite') startSuiteRun(item.filename);
    else startRun(item.filename);
  };

  return (
    <div className="run-picker">
      <p className="text-muted">{t('execution.pickToRun')}</p>
      <div className="run-picker-list">
        {displayItems.map(item => (
          <button
            key={`${item.type}-${item.filename}`}
            className="run-picker-item"
            onClick={() => handleRun(item)}
          >
            {item.type === 'suite' ? <FolderOpen size={14} /> : <FlaskConical size={14} />}
            <strong>{item.type === 'suite' ? 'Test Suite:' : 'Test:'}</strong>
            <span className="run-picker-name" title={item.name}>{item.name}</span>
            <span className="text-muted">{item.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsolePanel() {
  const { t } = useTranslation();
  const logEntries = useExecutionStore(s => s.logEntries);
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logEntries.length, expanded]);

  const logText = () =>
    logEntries.map(e => `${e.timestamp} [${e.level}] ${e.message}`).join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(logText());
  };

  const handleDownload = () => {
    const blob = new Blob([logText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wintest-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="console-panel">
      <div className="console-header">
        <button className="console-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Terminal size={14} />
          {t('execution.console')}
          {logEntries.length > 0 && <span className="console-count">{logEntries.length}</span>}
        </button>
        {expanded && logEntries.length > 0 && (
          <div className="console-actions">
            <button className="btn-icon" onClick={handleCopy} title={t('execution.copyLogs')}>
              <ClipboardCopy size={14} />
            </button>
            <button className="btn-icon" onClick={handleDownload} title={t('execution.downloadLogs')}>
              <Download size={14} />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="console-output">
          {logEntries.length === 0 ? (
            <p className="text-muted">{t('execution.noLogs')}</p>
          ) : (
            logEntries.map((entry, i) => (
              <div key={i} className={`console-line console-${entry.level.toLowerCase()}`}>
                <span className="console-time">{entry.timestamp}</span>
                <span className="console-level">{entry.level}</span>
                <span className="console-msg">{entry.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
