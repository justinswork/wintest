import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stepDocList } from '../docs';
import type { StepDoc } from '../docs';

const COMMON_PARAMS = [
  {
    name: 'description',
    type: 'string',
    description: 'An optional human-readable label for the step. Shown in logs, reports, and the execution viewer.',
  },
  {
    name: 'retry_attempts',
    type: 'number',
    description: 'Number of times to retry the step on failure before marking it as failed. Defaults to 3.',
  },
  {
    name: 'retry_delay',
    type: 'number',
    description: 'Seconds to wait between retry attempts. Defaults to 2.0.',
  },
  {
    name: 'timeout',
    type: 'number',
    description: 'Override the default step timeout in seconds. If the step takes longer than this, it is marked as failed.',
  },
];

function StepCard({ doc }: { doc: StepDoc }) {
  const { t } = useTranslation();

  return (
    <div className="step-doc-card card" id={`step-${doc.name}`}>
      <h3>
        <code>{doc.name}</code>
        <span className="step-doc-title">{doc.title}</span>
      </h3>
      <p className="step-doc-summary">{doc.summary}</p>
      <p className="step-doc-description">{doc.description}</p>

      <h4>{t('help.parametersLabel')}</h4>
      <table className="param-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th></th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {doc.parameters.map(p => (
            <tr key={p.name}>
              <td><code>{p.name}</code></td>
              <td><code>{p.type}</code></td>
              <td>
                <span className={`param-badge ${p.required ? 'param-required' : 'param-optional'}`}>
                  {p.required ? t('help.requiredLabel') : t('help.optionalLabel')}
                </span>
              </td>
              <td>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t('help.exampleLabel')}</h4>
      <pre className="yaml-example"><code>{doc.example}</code></pre>
    </div>
  );
}

export function Help() {
  const { t } = useTranslation();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [hash]);

  return (
    <div className="help-page">
      <h2>{t('help.title')}</h2>

      <section className="help-section">
        <h3>{t('help.overview')}</h3>
        <p>
          wintest is an AI-powered Windows UI testing tool. It automates desktop applications
          by taking screenshots, sending them to an AI vision model, and executing steps based
          on what the model sees on screen.
        </p>
        <p>
          Tests are defined as YAML test files containing a list of steps. Each step specifies a
          type to perform (click, type, verify, etc.) along with parameters like a target element
          description or text to type. When a test runs, wintest processes each step in order:
        </p>
        <ol>
          <li>Captures a screenshot of the current screen</li>
          <li>Sends the screenshot and step target to the AI vision model</li>
          <li>The model identifies the target element and returns coordinates</li>
          <li>wintest performs the step (click, type, etc.) at those coordinates</li>
          <li>Results are recorded with pass/fail status, timing, and screenshots</li>
        </ol>
        <p>
          Tests can be created and managed through this web UI or by editing YAML files directly
          in the <code>tests/</code> directory.
        </p>
      </section>

      <section className="help-section">
        <h3>{t('help.stepTypes')}</h3>
        {stepDocList.map(doc => (
          <StepCard key={doc.name} doc={doc} />
        ))}
      </section>

      <section className="help-section">
        <h3>{t('help.commonParams')}</h3>
        <p>
          These parameters can be set on any step type to control execution behavior.
        </p>
        <table className="param-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {COMMON_PARAMS.map(p => (
              <tr key={p.name}>
                <td><code>{p.name}</code></td>
                <td><code>{p.type}</code></td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
