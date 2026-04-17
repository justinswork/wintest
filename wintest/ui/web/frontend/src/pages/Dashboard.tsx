import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, XCircle, Trash2, Settings, Play, Square, CheckCircle2, Circle } from 'lucide-react';
import { useExecutionStore } from '../stores/executionStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useExecutionWebSocket } from '../api/ws';
import { reportApi, settingsApi } from '../api/client';
import { StatusBadge } from '../components/common/StatusBadge';
import { showToast } from '../components/common/Toast';
import type { ReportSummary } from '../api/types';

const STATUS_KEYS: Record<string, string> = {
  idle: 'execution.idle',
  running: 'execution.running',
  completed: 'execution.completed',
  failed: 'execution.failed',
  cancelled: 'execution.cancelled',
};

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fetchStatus, handleWsMessage, cancelRun, status, testName, currentStep, totalSteps, stepResults, currentLabel, error } = useExecutionStore();
  const { pipelines, schedulerStatus, fetchPipelines, fetchSchedulerStatus, startScheduler, stopScheduler } = usePipelineStore();

  const handleStartScheduler = async () => {
    try {
      const res = await startScheduler();
      if (res.started) {
        showToast(t('pipelines.schedulerStartRequested'));
        return;
      }
      if (res.reason === 'already_running') {
        showToast(t('pipelines.schedulerAlreadyRunning'));
        return;
      }
      const detail = res.reason === 'exited_early'
        ? `exited early (code ${res.exit_code ?? '?'})`
        : (res.reason ?? res.error ?? 'unknown');
      showToast(`${t('pipelines.schedulerStartFailed')}: ${detail}`, 'error');
    } catch {
      showToast(t('pipelines.schedulerStartFailed'), 'error');
    }
  };

  const handleStopScheduler = async () => {
    if (!window.confirm(t('pipelines.stopSchedulerConfirm'))) return;
    try {
      const res = await stopScheduler();
      if (res.stopped) {
        showToast(res.forced
          ? t('pipelines.schedulerStoppedForced')
          : t('pipelines.schedulerStoppedToast'));
      } else if (res.reason === 'not_running') {
        showToast(t('pipelines.schedulerNotRunning'));
      } else {
        showToast(t('pipelines.schedulerStopFailed'), 'error');
      }
    } catch {
      showToast(t('pipelines.schedulerStopFailed'), 'error');
    }
  };
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [workspaceConfigured, setWorkspaceConfigured] = useState(true);

  useExecutionWebSocket(handleWsMessage);

  useEffect(() => {
    fetchStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    settingsApi.getWorkspace().then(data => {
      setWorkspaceConfigured(data.configured !== false);
      if (data.configured !== false) {
        reportApi.list().then(setReports);
        fetchPipelines();
        fetchSchedulerStatus();
        interval = setInterval(fetchSchedulerStatus, 5_000);
      }
    });
    return () => { if (interval) clearInterval(interval); };
  }, [fetchStatus, fetchPipelines, fetchSchedulerStatus]);

  const handleDeleteReport = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!window.confirm(t('reports.deleteConfirm'))) return;
    try {
      await reportApi.delete(reportId);
      setReports(prev => prev.filter(r => r.report_id !== reportId));
    } catch {
      // ignore
    }
  };

  const showExecution = status !== 'idle' || testName;
  const passedCount = stepResults.filter(r => r.passed).length;
  const failedCount = stepResults.filter(r => !r.passed).length;
  const hasFailed = failedCount > 0;
  const isComplete = status === 'completed' || status === 'failed' || status === 'cancelled';
  const progressClass = isComplete
    ? (hasFailed ? 'progress-failed' : 'progress-passed')
    : (hasFailed ? 'progress-warning' : '');

  return (
    <div className="dashboard">
      {!workspaceConfigured && (
        <div className="workspace-banner">
          <p>{t('dashboard.workspaceNotConfigured')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/settings')}>
            <Settings size={16} />{t('dashboard.configureWorkspace')}
          </button>
        </div>
      )}

      {showExecution && (
        <div className="section">
          <div className="section-header">
            <h2>{t('dashboard.execution')}</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {status === 'running' && (
                <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); cancelRun(); }}>
                  <XCircle size={16} />{t('execution.cancel')}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/execution')}>
                {t('dashboard.viewDetails')}<ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="card card-clickable" onClick={() => navigate('/execution')}>
            <div className="card-row">
              <h3>{testName ?? t('execution.title')}</h3>
              <span className={`execution-status status-${status}`}>
                {t(STATUS_KEYS[status] ?? 'execution.idle')}
              </span>
            </div>
            {totalSteps > 0 && (
              <div className="progress-bar-container">
                <div
                  className={`progress-bar ${progressClass}`}
                  style={{ width: `${(stepResults.length / totalSteps) * 100}%` }}
                />
                <span className="progress-text">
                  {stepResults.length} / {totalSteps}
                </span>
              </div>
            )}
            {currentLabel && status === 'running' && (
              <p className="text-muted">{t('dashboard.currentStep', { step: currentStep, label: currentLabel })}</p>
            )}
            {stepResults.length > 0 && (
              <p className="text-muted">
                {t('dashboard.stepSummary', { passed: passedCount, failed: failedCount })}
              </p>
            )}
            {error && <p className="text-danger">{error}</p>}
          </div>
        </div>
      )}

      {workspaceConfigured && pipelines.length > 0 && (() => {
        const todayIdx = new Date().getDay(); // 0=Sun..6=Sat
        const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][todayIdx];
        const currentTime = (() => {
          const d = new Date();
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        })();
        const todays = pipelines
          .filter(p => p.enabled && p.schedule_days.includes(dayKey))
          .sort((a, b) => a.schedule_time.localeCompare(b.schedule_time));
        const running = schedulerStatus.current_run;

        return (
          <div className="section">
            <div className="section-header">
              <h2>{t('dashboard.pipelinesToday')}</h2>
              <div className="header-actions">
                {schedulerStatus.running ? (
                  <button className="btn btn-danger" onClick={handleStopScheduler}>
                    <Square size={16} />{t('pipelines.stopScheduler')}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleStartScheduler}>
                    <Play size={16} />{t('pipelines.startScheduler')}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => navigate('/pipelines')}>
                  {t('dashboard.viewAll')}<ArrowRight size={16} />
                </button>
              </div>
            </div>

            {running && (
              <div className="pipeline-running-banner">
                <span className="spinner" />
                <span>
                  <strong>{t('pipelines.running')}:</strong> {running.pipeline_name}
                  <span className="text-muted">
                    {' '}&middot; {running.target_type === 'suite' ? 'Suite' : 'Test'}: {running.target_file}
                  </span>
                </span>
                <button className="btn btn-sm" onClick={() => navigate('/execution')}
                  style={{ marginLeft: 'auto' }}>
                  {t('dashboard.viewDetails')}<ArrowRight size={14} />
                </button>
              </div>
            )}

            <p className="section-description">{t('dashboard.pipelinesTodayDescription')}</p>

            <div className={`scheduler-status-inline${schedulerStatus.running ? ' running' : ''}`}
                 style={{ marginBottom: '0.75rem' }}>
              <span className="status-dot" />
              {schedulerStatus.running
                ? t('pipelines.schedulerRunning')
                : t('pipelines.schedulerStopped')}
            </div>

            {todays.length === 0 ? (
              <p className="empty-state">{t('dashboard.noPipelinesToday')}</p>
            ) : (
              <div className="pipeline-today-list">
                {todays.map(p => {
                  const isRunning = running && running.pipeline_filename === p.filename;
                  const alreadyRan = !isRunning && p.schedule_time < currentTime;
                  const Icon = isRunning ? Play : alreadyRan ? CheckCircle2 : Circle;
                  return (
                    <div key={p.filename}
                         className={`pipeline-today-item${isRunning ? ' running' : ''}${alreadyRan ? ' completed' : ''}`}
                         onClick={() => navigate(`/pipelines/edit/${p.filename}`)}>
                      <Icon size={16} />
                      <span className="pipeline-today-time">{p.schedule_time}</span>
                      <span className="pipeline-today-name">{p.name}</span>
                      <span className="text-muted pipeline-today-target">
                        {p.target_type === 'suite' ? 'Suite' : 'Test'}: {p.target_file}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div className="section">
        <div className="section-header">
          <h2>{t('dashboard.recentReports')}</h2>
          {reports.length > 0 && (
            <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
              {t('dashboard.viewAll')}<ArrowRight size={16} />
            </button>
          )}
        </div>
        {reports.length === 0 ? (
          <p className="empty-state">{t('dashboard.noReports')}</p>
        ) : (
          <div className="card-grid">
            {reports.slice(0, 5).map(report => (
              <div key={report.report_id} className="card card-clickable" onClick={() => navigate(`/reports/${report.report_id}`)}>
                <div className="card-row">
                  <h3 title={report.test_name}>{report.test_name}</h3>
                  <StatusBadge passed={report.passed} />
                </div>
                <p className="text-muted">
                  {t('reports.passedCount', { passed: report.passed_count, total: report.total })} &middot; {new Date(report.generated_at).toLocaleString()}
                </p>
                <div className="card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon danger" onClick={(e) => handleDeleteReport(e, report.report_id)} title={t('common.delete')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
