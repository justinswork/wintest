import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Play, Pencil, Trash2 } from 'lucide-react';
import { useTestStore } from '../stores/testStore';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { useExecutionStore } from '../stores/executionStore';
import { reportApi, executionApi } from '../api/client';
import { StatusBadge } from '../components/common/StatusBadge';
import { showToast } from '../components/common/Toast';
import type { ReportSummary } from '../api/types';

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tests, fetchTests, deleteTest } = useTestStore();
  const { testSuites, fetchTestSuites, deleteTestSuite } = useTestSuiteStore();
  const { modelStatus, loadModel, fetchStatus, startRun, status } = useExecutionStore();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    fetchTests();
    fetchTestSuites();
    fetchStatus();
    reportApi.list().then(setReports);
  }, [fetchTests, fetchTestSuites, fetchStatus]);

  const handleRun = async (filename: string) => {
    await startRun(filename);
    navigate('/execution');
  };

  const handleDeleteTest = async (filename: string, name: string) => {
    if (!window.confirm(t('dashboard.deleteTestConfirm', { name }))) return;
    try {
      await deleteTest(filename);
      showToast(t('dashboard.testDeleted'));
    } catch {
      showToast(t('dashboard.testDeleteFailed'), 'error');
    }
  };

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

      <div className="section">
        <div className="section-header">
          <h2>{t('dashboard.tests')}</h2>
          <button className="btn btn-primary" onClick={() => navigate('/tests/new')}><Plus size={16} />{t('dashboard.newTest')}</button>
        </div>
        {tests.length === 0 ? (
          <p className="empty-state">{t('dashboard.noTests')}</p>
        ) : (
          <div className="card-grid">
            {tests.map(test => (
              <div key={test.filename} className="card">
                <h3>{test.name}</h3>
                <p className="text-muted">{test.filename} &middot; {test.step_count} steps</p>
                <div className="card-actions">
                  <button className="btn-icon" onClick={() => handleRun(test.filename)} disabled={status === 'running'} title={t('common.run')}>
                    <Play size={16} />
                  </button>
                  <button className="btn-icon" onClick={() => navigate(`/tests/${test.filename}/edit`)} title={t('common.edit')}>
                    <Pencil size={16} />
                  </button>
                  <button className="btn-icon danger" onClick={() => handleDeleteTest(test.filename, test.name)} title={t('common.delete')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-header">
          <h2>{t('dashboard.testSuites')}</h2>
          <button className="btn btn-primary" onClick={() => navigate('/test-suites/new')}><Plus size={16} />{t('dashboard.newTestSuite')}</button>
        </div>
        {testSuites.length === 0 ? (
          <p className="empty-state">{t('dashboard.noTestSuites')}</p>
        ) : (
          <div className="card-grid">
            {testSuites.map(testSuite => (
              <div key={testSuite.filename} className="card card-clickable" onClick={() => navigate(`/test-suites/${testSuite.filename}`)}>
                <h3>{testSuite.name}</h3>
                <p className="text-muted">{testSuite.filename} &middot; {testSuite.test_count} tests</p>
                {testSuite.description && <p className="text-muted">{testSuite.description}</p>}
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    onClick={async () => {
                      try {
                        await executionApi.runTestSuite(testSuite.filename);
                        navigate('/execution');
                      } catch {
                        showToast(t('dashboard.testSuiteRunFailed'), 'error');
                      }
                    }}
                    disabled={status === 'running'}
                    title={t('common.run')}
                  >
                    <Play size={16} />
                  </button>
                  <button className="btn-icon" onClick={() => navigate(`/test-suites/${testSuite.filename}/edit`)} title={t('common.edit')}>
                    <Pencil size={16} />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={async () => {
                      if (!window.confirm(t('dashboard.deleteTestSuiteConfirm', { name: testSuite.name }))) return;
                      try {
                        await deleteTestSuite(testSuite.filename);
                        showToast(t('dashboard.testSuiteDeleted'));
                      } catch {
                        showToast(t('dashboard.testSuiteDeleteFailed'), 'error');
                      }
                    }}
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
