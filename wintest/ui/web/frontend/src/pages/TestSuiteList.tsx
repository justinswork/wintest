import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Play, Pencil, Trash2, Copy, RefreshCw } from 'lucide-react';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { useExecutionStore } from '../stores/executionStore';
import { executionApi, testSuiteApi } from '../api/client';
import { showToast } from '../components/common/Toast';

export function TestSuiteList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { testSuites, fetchTestSuites, deleteTestSuite, saveTestSuite } = useTestSuiteStore();
  const { status } = useExecutionStore();

  useEffect(() => {
    fetchTestSuites();
  }, [fetchTestSuites]);

  const handleRun = async (filename: string) => {
    try {
      await executionApi.runTestSuite(filename);
      navigate('/execution');
    } catch {
      showToast(t('dashboard.testSuiteRunFailed'), 'error');
    }
  };

  const handleDuplicate = async (filename: string, name: string) => {
    try {
      const suite = await testSuiteApi.get(filename);
      await saveTestSuite({ ...suite, name: `${name} (Copy)`, filename: null });
      await fetchTestSuites();
      showToast(t('common.duplicated'));
    } catch {
      showToast(t('common.duplicateFailed'), 'error');
    }
  };

  const handleDelete = async (filename: string, name: string) => {
    if (!window.confirm(t('dashboard.deleteTestSuiteConfirm', { name }))) return;
    try {
      await deleteTestSuite(filename);
      showToast(t('dashboard.testSuiteDeleted'));
    } catch {
      showToast(t('dashboard.testSuiteDeleteFailed'), 'error');
    }
  };

  return (
    <div className="test-suite-list">
      <div className="section-header">
        <h2>{t('dashboard.testSuites')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn-icon" onClick={() => fetchTestSuites()} title={t('common.refresh')}>
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/test-suites/new')}>
            <Plus size={16} />{t('dashboard.newTestSuite')}
          </button>
        </div>
      </div>
      {testSuites.length === 0 ? (
        <p className="empty-state">{t('dashboard.noTestSuites')}</p>
      ) : (
        <div className="card-grid">
          {testSuites.map(testSuite => (
            <div key={testSuite.filename} className="card card-clickable" onClick={() => navigate(`/test-suites/view/${testSuite.filename}`)}>
              <h3>{testSuite.name}</h3>
              <p className="text-muted">{testSuite.filename} &middot; {testSuite.test_count} tests</p>
              {testSuite.description && <p className="text-muted">{testSuite.description}</p>}
              <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn-icon" onClick={() => handleRun(testSuite.filename)} disabled={status === 'running'} title={t('common.run')}>
                  <Play size={16} />
                </button>
                <button className="btn-icon" onClick={() => navigate(`/test-suites/edit/${testSuite.filename}`)} title={t('common.edit')}>
                  <Pencil size={16} />
                </button>
                <button className="btn-icon" onClick={() => handleDuplicate(testSuite.filename, testSuite.name)} title={t('common.duplicate')}>
                  <Copy size={16} />
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(testSuite.filename, testSuite.name)} title={t('common.delete')}>
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
