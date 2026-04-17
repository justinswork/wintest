import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, RefreshCw, FolderOpen, Clock, Play, Square } from 'lucide-react';
import { usePipelineStore } from '../stores/pipelineStore';
import { fileApi, settingsApi } from '../api/client';
import { showToast } from '../components/common/Toast';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function formatDays(days: string[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekend = ['saturday', 'sunday'];
  if (weekdays.every(d => set.has(d)) && !weekend.some(d => set.has(d))) return 'Weekdays';
  if (weekend.every(d => set.has(d)) && !weekdays.some(d => set.has(d))) return 'Weekends';
  return DAY_ORDER.filter(d => set.has(d)).map(d => DAY_SHORT[d]).join(', ');
}

export function PipelineList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    pipelines, fetchPipelines, deletePipeline, setEnabled,
    schedulerStatus, fetchSchedulerStatus, startScheduler, stopScheduler,
  } = usePipelineStore();

  const handleStart = async () => {
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

  const handleStop = async () => {
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

  useEffect(() => {
    fetchPipelines();
    fetchSchedulerStatus();
    const interval = setInterval(fetchSchedulerStatus, 10_000);
    return () => clearInterval(interval);
  }, [fetchPipelines, fetchSchedulerStatus]);

  const handleDelete = async (filename: string, name: string) => {
    if (!window.confirm(t('pipelines.deleteConfirm', { name }))) return;
    try {
      await deletePipeline(filename);
      showToast(t('pipelines.deleted'));
    } catch {
      showToast(t('pipelines.deleteFailed'), 'error');
    }
  };

  const handleToggle = async (filename: string, enabled: boolean) => {
    try {
      await setEnabled(filename, enabled);
    } catch {
      showToast(t('pipelines.toggleFailed'), 'error');
    }
  };

  return (
    <div className="pipeline-list">
      <div className="section-header">
        <div className="header-actions-left">
          <h2>{t('pipelines.title')}</h2>
          <button className="btn btn-primary" onClick={() => navigate('/pipelines/new')}>
            <Plus size={16} />{t('pipelines.newPipeline')}
          </button>
          <button className="btn-icon" onClick={() => {
            settingsApi.getWorkspace().then(data => {
              if (data.root) fileApi.openFolder(`${data.root}/pipelines`);
            });
          }} title={t('common.openFolder')}>
            <FolderOpen size={16} />
          </button>
          <button className="btn-icon" onClick={() => fetchPipelines()} title={t('common.refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className={`scheduler-status${schedulerStatus.running ? ' running' : ''}`}>
        <span className="status-dot" />
        <span>
          {schedulerStatus.running
            ? (schedulerStatus.current_run
                ? t('pipelines.schedulerRunningPipeline', { name: schedulerStatus.current_run.pipeline_name })
                : t('pipelines.schedulerRunning'))
            : t('pipelines.schedulerStopped')}
        </span>
        {schedulerStatus.running ? (
          <button className="btn btn-sm btn-danger" onClick={handleStop} style={{ marginLeft: 'auto' }}>
            <Square size={14} />{t('pipelines.stopScheduler')}
          </button>
        ) : (
          <button className="btn btn-sm" onClick={handleStart} style={{ marginLeft: 'auto' }}>
            <Play size={14} />{t('pipelines.startScheduler')}
          </button>
        )}
      </div>

      {pipelines.length === 0 ? (
        <p className="empty-state">{t('pipelines.noPipelines')}</p>
      ) : (
        <div className="card-grid">
          {pipelines.map(p => (
            <div key={p.filename} className="card card-clickable" onClick={() => navigate(`/pipelines/edit/${p.filename}`)}>
              <h3 title={`${p.name}\n${p.filename}`}>{p.name}</h3>
              <p className="pipeline-schedule">
                <Clock size={14} /> {formatDays(p.schedule_days)} at {p.schedule_time}
              </p>
              <p className="pipeline-target">
                {p.target_type === 'suite' ? 'Suite' : 'Test'}: {p.target_file}
              </p>
              <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                <label className="pipeline-toggle">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => handleToggle(p.filename, e.target.checked)}
                  />
                  {p.enabled ? t('pipelines.enabled') : t('pipelines.disabled')}
                </label>
                <button className="btn-icon" onClick={() => navigate(`/pipelines/edit/${p.filename}`)} title={t('common.edit')}>
                  <Pencil size={16} />
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(p.filename, p.name)} title={t('common.delete')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
