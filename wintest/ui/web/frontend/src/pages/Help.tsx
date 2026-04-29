import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stepDocList } from '../docs';
import type { StepDoc, StepParam } from '../docs';
import { useTestStore } from '../stores/testStore';

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

function StepCard({ doc, requiresVision }: { doc: StepDoc; requiresVision?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="step-doc-card card" id={`step-${doc.name}`}>
      <h3>
        <code>{doc.name}</code>
        <span className="step-doc-title">
          {requiresVision ? `✨ ${doc.title}` : doc.title}
        </span>
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
          {doc.parameters.map((p: StepParam) => (
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
  const { stepTypes, fetchStepTypes } = useTestStore();

  useEffect(() => {
    if (stepTypes.length === 0) fetchStepTypes();
  }, [stepTypes.length, fetchStepTypes]);

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [hash]);

  const requiresVisionByName = new Map(
    stepTypes.map(s => [s.name, s.requires_vision]),
  );
  const standardDocs = stepDocList.filter(d => !requiresVisionByName.get(d.name));
  const aiDocs = stepDocList.filter(d => requiresVisionByName.get(d.name));

  return (
    <div className="help-page">
      <h2>{t('help.title')}</h2>

      <section className="help-section">
        <h3>{t('help.overview')}</h3>
        <p>
          wintest is an automated UI testing tool for Windows desktop applications.
          It drives any GUI — office suites, engineering tools, in-house apps — without
          needing source access, accessibility APIs, or DOM selectors.
        </p>
        <p>
          The typical workflow is record-and-replay:
        </p>
        <ol>
          <li>
            Open the <strong>Test Builder</strong>, launch your application, and click
            through it. Each click is captured as a test step with pixel-exact coordinates.
          </li>
          <li>
            Add assertions alongside the clicks — compare files your app produces to
            saved baselines, or compare a region of the screen to a reference screenshot.
          </li>
          <li>
            Run the test. wintest replays your clicks, types the recorded text, and
            checks the assertions. Failures show exactly what went wrong, including file
            and screenshot diffs.
          </li>
          <li>
            Group related tests into <strong>test suites</strong>, and create{' '}
            <strong>pipelines</strong> to run a test or suite automatically on selected
            days and times.
          </li>
        </ol>
        <p>
          Tests are stored as plain YAML files in the workspace. You rarely write the
          YAML by hand — the Test Builder and Test Editor generate it for you — but
          it's human-readable if you want to tweak a step directly.
        </p>
        <p>
          Tests support <strong>variables</strong> (defined in the{' '}
          <code>variables:</code> block or set at runtime with <code>set_variable</code>)
          referenced in any string field via <code>{"{{variable_name}}"}</code> syntax.
          The <strong>loop</strong> step repeats a range of steps do/while style, and{' '}
          <strong>tags</strong> let you filter the test list.
        </p>
        <p>
          Most clicks are recorded by coordinate — fast, deterministic, and the
          recommended default. Click/verify steps can <em>optionally</em> use an AI
          vision model to locate an element by description instead, which is handy when a
          UI layout may shift between runs. The AI model is only loaded for tests that
          actually need it.
        </p>
        <p>
          Scheduled pipelines are triggered by a separate <strong>scheduler</strong>{' '}
          process that runs in the background. Start it from the Pipelines page, run{' '}
          <code>wintest scheduler</code> in a terminal, or use{' '}
          <code>wintest scheduler --install-startup</code> to launch it automatically
          at Windows login. UI automation requires an interactive desktop session, so
          the machine must stay logged in.
        </p>
      </section>

      <section className="help-section">
        <h3>{t('help.stepTypes')}</h3>
        {standardDocs.map(doc => (
          <StepCard key={doc.name} doc={doc} />
        ))}

        {aiDocs.length > 0 && (
          <>
            <h3 className="help-ai-heading">✨ {t('help.aiStepsHeading')}</h3>
            <p className="text-muted">{t('help.aiStepsDescription')}</p>
            {aiDocs.map(doc => (
              <StepCard key={doc.name} doc={doc} requiresVision />
            ))}
          </>
        )}
      </section>

      <section className="help-section">
        <h3>{t('help.commonParams')}</h3>
        <p>
          These parameters can be set on most step types to control execution behavior.
          They do not apply to runner-level steps
          (<code>launch_application</code>, <code>set_variable</code>, <code>loop</code>).
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
