import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, XCircle, Trash2 } from 'lucide-react';
import { useExecutionStore } from '../stores/executionStore';
import { useExecutionWebSocket } from '../api/ws';
import { reportApi } from '../api/client';
import { StatusBadge } from '../components/common/StatusBadge';
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
  const { modelStatus, loadModel, fetchStatus, handleWsMessage, cancelRun, status, testName, currentStep, totalSteps, stepResults, currentLabel, error } = useExecutionStore();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useExecutionWebSocket(handleWsMessage);

  useEffect(() => {
    fetchStatus();
    reportApi.list().then(setReports);
  }, [fetchStatus]);

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
      <div className="section">
        <div className="section-header">
          <h2>{t('dashboard.modelStatus')}</h2>
        </div>
        <div className="model-status-card">
          <span className={`model-indicator model-${modelStatus}`} />
          <span>{modelStatus === 'loaded' ? t('dashboard.modelLoaded') : modelStatus === 'loading' ? t('dashboard.modelLoading') : t('dashboard.modelNotLoaded')}</span>
          {modelStatus === 'not_loaded' && (
            <button className="btn btn-secondary" onClick={loadModel}>{t('dashboard.preloadModel')}</button>
          )}
        </div>
      </div>

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

      <div className="section">
        <div className="section-header">
          <h2>{t('dashboard.recentReports')}</h2>
          {reports.length > 0 && (
            <button className="btn btn-secondary" onClick={() => navigate('/reports')}>{t('dashboard.viewAll')}</button>
          )}
        </div>
        {reports.length === 0 ? (
          <p className="empty-state">{t('dashboard.noReports')}</p>
        ) : (
          <div className="card-grid">
            {reports.slice(0, 5).map(report => (
              <div key={report.report_id} className="card card-clickable" onClick={() => navigate(`/reports/${report.report_id}`)}>
                <div className="card-row">
                  <h3>{report.test_name}</h3>
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
