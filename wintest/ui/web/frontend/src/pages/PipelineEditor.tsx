import { useEffect, useState } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft } from 'lucide-react';
import { usePipelineStore } from '../stores/pipelineStore';
import { useTestStore } from '../stores/testStore';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { showToast } from '../components/common/Toast';
import type { Pipeline } from '../api/types';

const DAYS: { key: string; short: string }[] = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const EVERY_DAY = DAYS.map(d => d.key);

const EMPTY_PIPELINE: Pipeline = {
  name: '',
  filename: null,
  enabled: true,
  target_type: 'test',
  target_file: '',
  schedule_days: [],
  schedule_time: '22:00',
};

export function PipelineEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { '*': filename } = useParams();
  const isEditing = !!filename;

  const { currentPipeline, fetchPipeline, savePipeline, setCurrentPipeline } = usePipelineStore();
  const { tests, fetchTests } = useTestStore();
  const { testSuites, fetchTestSuites } = useTestSuiteStore();

  const [pipeline, setPipeline] = useState<Pipeline>(EMPTY_PIPELINE);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchTestSuites();
    if (isEditing && filename) {
      fetchPipeline(filename);
    } else {
      setCurrentPipeline(null);
      setPipeline(EMPTY_PIPELINE);
    }
    setDirty(false);
  }, [filename, isEditing, fetchPipeline, fetchTests, fetchTestSuites, setCurrentPipeline]);

  useEffect(() => {
    if (currentPipeline && isEditing) {
      setPipeline(currentPipeline);
      setDirty(false);
    }
  }, [currentPipeline, isEditing]);

  const updatePipeline = (next: Pipeline) => {
    setPipeline(next);
    setDirty(true);
  };

  const toggleDay = (day: string) => {
    setPipeline(p => ({
      ...p,
      schedule_days: p.schedule_days.includes(day)
        ? p.schedule_days.filter(d => d !== day)
        : [...p.schedule_days, day],
    }));
    setDirty(true);
  };

  const blocker = useBlocker(dirty && !saving);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm(t('pipelineEditor.unsavedChanges'));
      if (leave) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, t]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleSave = async () => {
    if (!pipeline.name.trim()) {
      showToast(t('pipelineEditor.nameRequired'), 'error');
      return;
    }
    if (!pipeline.target_file) {
      showToast(t('pipelineEditor.targetRequired'), 'error');
      return;
    }
    if (pipeline.schedule_days.length === 0) {
      showToast(t('pipelineEditor.daysRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await savePipeline(pipeline, isEditing ? filename : undefined);
      setDirty(false);
      showToast(t('pipelineEditor.saved'));
      navigate('/pipelines');
    } catch {
      showToast(t('pipelineEditor.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const targetOptions = pipeline.target_type === 'test' ? tests : testSuites;

  return (
    <div className="pipeline-editor">
      <div className="page-header">
        <h1>
          {isEditing
            ? t('pipelineEditor.editPipeline', { name: pipeline.name })
            : t('pipelineEditor.newPipeline')}
        </h1>
        <div className="header-actions">
          <button className="btn" onClick={() => navigate('/pipelines')}>
            <ArrowLeft size={16} />{t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !pipeline.name}>
            <Save size={16} />{saving ? t('pipelineEditor.saving') : t('pipelineEditor.save')}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>{t('pipelineEditor.pipelineName')}</label>
        <input
          className="input"
          type="text"
          value={pipeline.name}
          onChange={(e) => updatePipeline({ ...pipeline, name: e.target.value })}
          placeholder={t('pipelineEditor.pipelineNamePlaceholder')}
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={pipeline.enabled}
            onChange={(e) => updatePipeline({ ...pipeline, enabled: e.target.checked })}
          />
          {t('pipelineEditor.enabled')}
        </label>
      </div>

      <div className="form-group">
        <label>{t('pipelineEditor.targetType')}</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="target_type"
              checked={pipeline.target_type === 'test'}
              onChange={() => updatePipeline({ ...pipeline, target_type: 'test', target_file: '' })}
            />
            {t('pipelineEditor.targetTest')}
          </label>
          <label>
            <input
              type="radio"
              name="target_type"
              checked={pipeline.target_type === 'suite'}
              onChange={() => updatePipeline({ ...pipeline, target_type: 'suite', target_file: '' })}
            />
            {t('pipelineEditor.targetSuite')}
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>{t('pipelineEditor.targetFile')}</label>
        <select
          className="input"
          value={pipeline.target_file}
          onChange={(e) => updatePipeline({ ...pipeline, target_file: e.target.value })}
        >
          <option value="">{t('pipelineEditor.selectTarget')}</option>
          {targetOptions.map(item => (
            <option key={item.filename} value={item.filename}>
              {item.name} ({item.filename})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>{t('pipelineEditor.scheduleDays')}</label>
        <div className="day-picker">
          {DAYS.map(d => {
            const active = pipeline.schedule_days.includes(d.key);
            return (
              <label key={d.key} className={`day-pill${active ? ' active' : ''}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleDay(d.key)}
                />
                {d.short}
              </label>
            );
          })}
        </div>
        <div className="day-shortcuts">
          <button type="button" className="btn btn-sm" onClick={() =>
            updatePipeline({ ...pipeline, schedule_days: WEEKDAYS })
          }>
            {t('pipelineEditor.weekdays')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() =>
            updatePipeline({ ...pipeline, schedule_days: EVERY_DAY })
          }>
            {t('pipelineEditor.everyday')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() =>
            updatePipeline({ ...pipeline, schedule_days: [] })
          }>
            {t('common.clear')}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>{t('pipelineEditor.scheduleTime')}</label>
        <input
          className="input input-time"
          type="time"
          value={pipeline.schedule_time}
          onChange={(e) => updatePipeline({ ...pipeline, schedule_time: e.target.value })}
        />
      </div>
    </div>
  );
}
