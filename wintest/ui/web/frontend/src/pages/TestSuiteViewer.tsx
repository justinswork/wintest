import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { useExecutionStore } from '../stores/executionStore';
import { executionApi } from '../api/client';
import { showToast } from '../components/common/Toast';

export function TestSuiteViewer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { filename } = useParams();
  const { currentTestSuite, fetchTestSuite, loading } = useTestSuiteStore();
  const { status: runStatus } = useExecutionStore();

  useEffect(() => {
    if (filename) {
      fetchTestSuite(filename);
    }
  }, [filename, fetchTestSuite]);

  const handleRunTestSuite = async () => {
    if (!filename) return;
    try {
      await executionApi.runTestSuite(filename);
      navigate('/execution');
    } catch {
      showToast(t('testSuiteViewer.runFailed'), 'error');
    }
  };

  const handleRunSingleTest = async (testFile: string) => {
    try {
      await executionApi.run(testFile);
      navigate('/execution');
    } catch {
      showToast(t('testSuiteViewer.runFailed'), 'error');
    }
  };

  if (loading || !currentTestSuite) {
    return <div className="loading">{t('testSuiteViewer.loading')}</div>;
  }

  return (
    <div className="test-suite-viewer">
      <div className="page-header">
        <div>
          <h1>{currentTestSuite.name}</h1>
          {currentTestSuite.description && (
            <p className="text-muted">{currentTestSuite.description}</p>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={handleRunTestSuite}
            disabled={runStatus === 'running'}
          >
            {t('testSuiteViewer.runAll')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/test-suites/${filename}/edit`)}
          >
            {t('common.edit')}
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>{t('testSuiteViewer.tests', { count: currentTestSuite.test_paths.length })}</h2>
        </div>
        <div className="test-suite-test-list">
          {currentTestSuite.test_paths.map((path, index) => (
            <div key={path} className="test-suite-test-item">
              <span className="test-suite-test-index">{index + 1}</span>
              <span className="test-suite-test-path">{path}</span>
              <div className="test-suite-test-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRunSingleTest(path)}
                  disabled={runStatus === 'running'}
                >
                  {t('common.run')}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/tests/${path}/edit`)}
                >
                  {t('common.edit')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {currentTestSuite.settings.fail_fast && (
        <div className="info-box">
          {t('testSuiteViewer.failFastEnabled')}
        </div>
      )}
    </div>
  );
}
