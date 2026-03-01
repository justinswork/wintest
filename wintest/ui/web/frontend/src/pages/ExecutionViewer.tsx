import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpNarrowWide, ArrowDownNarrowWide, XCircle } from 'lucide-react';
import { useExecutionStore } from '../stores/executionStore';
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
        <div className="empty-state">
          <p>{t('execution.noExecution')}</p>
        </div>
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
    </div>
  );
}
