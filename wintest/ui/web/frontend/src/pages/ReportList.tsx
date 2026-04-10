import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, FolderOpen, RefreshCw } from 'lucide-react';
import { reportApi, fileApi, settingsApi } from '../api/client';
import { StatusBadge } from '../components/common/StatusBadge';
import { showToast } from '../components/common/Toast';
import type { ReportSummary } from '../api/types';

export function ReportList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  const fetchReports = () => reportApi.list().then(setReports);

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!window.confirm(t('reports.deleteConfirm'))) return;
    try {
      await reportApi.delete(reportId);
      setReports(prev => prev.filter(r => r.report_id !== reportId));
      showToast(t('reports.deleted'));
    } catch {
      showToast(t('reports.deleteFailed'), 'error');
    }
  };

  return (
    <div className="report-list">
      <div className="section-header">
        <div className="header-actions-left">
          <h2>{t('reports.title')}</h2>
          <button className="btn-icon" onClick={() => {
            settingsApi.getWorkspace().then(data => {
              if (data.reports_dir) fileApi.openFolder(data.reports_dir);
            });
          }} title={t('common.openFolder')}>
            <FolderOpen size={16} />
          </button>
          <button className="btn-icon" onClick={fetchReports} title={t('common.refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      {reports.length === 0 ? (
        <p className="empty-state">{t('reports.noReports')}</p>
      ) : (
        <div className="card-grid">
          {reports.map(report => (
            <div
              key={report.report_id}
              className="card card-clickable"
              onClick={() => navigate(`/reports/${report.report_id}`)}
            >
              <div className="card-row">
                <h3 title={report.test_name}>{report.test_name}</h3>
                <StatusBadge passed={report.passed} />
              </div>
              <p className="text-muted">
                {t('reports.passedCount', { passed: report.passed_count, total: report.total })} &middot; {t('reports.failedCount', { count: report.failed_count })}
              </p>
              <p className="text-muted">
                {new Date(report.generated_at).toLocaleString()}
              </p>
              <div className="card-actions">
                <button className="btn-icon danger" onClick={(e) => handleDelete(e, report.report_id)} title={t('common.delete')}>
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
