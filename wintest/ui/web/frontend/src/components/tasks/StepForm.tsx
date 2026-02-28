import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Step, FieldInfo } from '../../api/types';
import { useTestStore } from '../../stores/testStore';
import { StepPicker } from './StepPicker';

interface Props {
  step: Step;
  index: number;
  onChange: (index: number, step: Step) => void;
  onDelete: (index: number) => void;
}

type FieldRenderer = (
  step: Step,
  field: FieldInfo,
  update: (name: string, value: unknown) => void,
  t: (key: string) => string,
) => JSX.Element | null;

const FIELD_RENDERERS: Record<string, FieldRenderer> = {
  target: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.targetPlaceholder')}
      value={step.target ?? ''}
      onChange={e => update('target', e.target.value || null)}
    />
  ),
  text: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.textPlaceholder')}
      value={step.text ?? ''}
      onChange={e => update('text', e.target.value || null)}
    />
  ),
  key: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.keyPlaceholder')}
      value={step.key ?? ''}
      onChange={e => update('key', e.target.value || null)}
    />
  ),
  keys: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.keysPlaceholder')}
      value={step.keys?.join(', ') ?? ''}
      onChange={e => update('keys', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
    />
  ),
  scroll_amount: (step, _field, update, t) => (
    <input
      className="input"
      type="number"
      placeholder={t('stepForm.scrollPlaceholder')}
      value={step.scroll_amount}
      onChange={e => update('scroll_amount', parseInt(e.target.value) || 0)}
    />
  ),
  wait_seconds: (step, _field, update, t) => (
    <input
      className="input"
      type="number"
      step="0.5"
      placeholder={t('stepForm.waitPlaceholder')}
      value={step.wait_seconds}
      onChange={e => update('wait_seconds', parseFloat(e.target.value) || 0)}
    />
  ),
  app_path: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.appPathPlaceholder')}
      value={step.app_path ?? ''}
      onChange={e => update('app_path', e.target.value || null)}
    />
  ),
  app_title: (step, _field, update, t) => (
    <input
      className="input"
      placeholder={t('stepForm.appTitlePlaceholder')}
      value={step.app_title ?? ''}
      onChange={e => update('app_title', e.target.value || null)}
    />
  ),
};

export function StepForm({ step, index, onChange, onDelete }: Props) {
  const { t } = useTranslation();
  const { stepTypes } = useTestStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (field: string, value: unknown) => {
    onChange(index, { ...step, [field]: value });
  };

  const stepDef = stepTypes.find(a => a.name === step.action);
  const fields = stepDef?.fields ?? [];

  // Check if this step has a "verify"-style expected checkbox
  const isVerify = step.action === 'verify';

  const hasNonDefaultAdvanced =
    step.retry_attempts !== 3 ||
    step.retry_delay !== 2.0 ||
    step.timeout !== null;

  return (
    <div className="step-form">
      <div className="step-form-header">
        <span className="step-number">#{index + 1}</span>
        <StepPicker value={step.action} onChange={v => update('action', v)} />
        <Link to={`/help#step-${step.action}`} className="help-btn" title={t('stepForm.helpTooltip')}>?</Link>
        <input
          className="input flex-1"
          placeholder={t('stepForm.descriptionPlaceholder')}
          value={step.description}
          onChange={e => update('description', e.target.value)}
        />
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(index)}>{t('common.remove')}</button>
      </div>

      <div className="step-form-fields">
        {fields.map(field => {
          const renderer = FIELD_RENDERERS[field.name];
          if (!renderer) return null;
          return <div key={field.name}>{renderer(step, field, update, t)}</div>;
        })}
        {isVerify && (
          <label className="step-checkbox">
            <input
              type="checkbox"
              checked={step.expected}
              onChange={e => update('expected', e.target.checked)}
            />
            {t('stepForm.expectedLabel')}
          </label>
        )}
      </div>

      <button
        className="step-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? t('stepForm.hideAdvanced') : t('stepForm.showAdvanced')}
        {!showAdvanced && hasNonDefaultAdvanced && <span className="advanced-indicator" />}
      </button>

      {showAdvanced && (
        <div className="step-advanced">
          <div className="step-advanced-row">
            <label>
              {t('stepForm.retryAttempts')}
              <input
                className="input"
                type="number"
                min="0"
                value={step.retry_attempts}
                onChange={e => update('retry_attempts', parseInt(e.target.value) || 0)}
              />
            </label>
            <label>
              {t('stepForm.retryDelay')}
              <input
                className="input"
                type="number"
                min="0"
                step="0.5"
                value={step.retry_delay}
                onChange={e => update('retry_delay', parseFloat(e.target.value) || 0)}
              />
            </label>
            <label>
              {t('stepForm.timeout')}
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder={t('stepForm.timeoutPlaceholder')}
                value={step.timeout ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  update('timeout', v === '' ? null : parseFloat(v) || null);
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
