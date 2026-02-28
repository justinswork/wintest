import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reportApi } from '../api/client';
import { StatusBadge } from '../components/common/StatusBadge';
import { showToast } from '../components/common/Toast';
import type { ReportSummary } from '../api/types';

export function ReportList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    reportApi.list().then(setReports);
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
      <h2>{t('reports.title')}</h2>
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
                <h3>{report.test_name}</h3>
                <StatusBadge passed={report.passed} />
              </div>
              <p className="text-muted">
                {t('reports.passedCount', { passed: report.passed_count, total: report.total })} &middot; {t('reports.failedCount', { count: report.failed_count })}
              </p>
              <p className="text-muted">
                {new Date(report.generated_at).toLocaleString()}
              </p>
              <div className="card-actions">
                <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(e, report.report_id)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
