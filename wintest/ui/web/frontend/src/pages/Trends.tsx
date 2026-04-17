import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { reportApi } from '../api/client';
import type { ReportSummary } from '../api/types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type SortKey = 'name' | 'rate_asc' | 'rate_desc' | 'runs_desc' | 'recent';
type FilterKey = 'all' | 'failing' | 'flaky' | 'passing';

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function Trends() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedTest = searchParams.get('test');
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('rate_asc');
  const [filterKey, setFilterKey] = useState<FilterKey>('all');

  const setSelectedTest = (name: string | null) => {
    if (name) {
      navigate(`/trends?test=${encodeURIComponent(name)}`);
    } else {
      navigate('/trends');
    }
  };

  useEffect(() => {
    reportApi.list().then(data => {
      setReports(data);
      setLoading(false);
    });
  }, []);

  // Reports come newest-first; reverse for chronological order
  const allReports = useMemo(() => [...reports].reverse(), [reports]);

  // Group by test name
  const testGroups = useMemo(() => {
    const map = new Map<string, ReportSummary[]>();
    for (const r of allReports) {
      const list = map.get(r.test_name) ?? [];
      list.push(r);
      map.set(r.test_name, list);
    }
    return map;
  }, [allReports]);

  const testSummaries = useMemo(() => {
    const items = [...testGroups.entries()].map(([name, runs]) => {
      const passCount = runs.filter(r => r.passed).length;
      const rate = runs.length > 0 ? Math.round((passCount / runs.length) * 100) : 0;
      const mostRecent = runs.length > 0
        ? new Date(runs[runs.length - 1].generated_at).getTime()
        : 0;
      return { name, runs, rate, mostRecent };
    });
    return items;
  }, [testGroups]);

  const filteredSorted = useMemo(() => {
    let items = testSummaries;
    if (filterKey === 'failing') items = items.filter(i => i.rate < 75);
    else if (filterKey === 'flaky') items = items.filter(i => i.rate >= 75 && i.rate < 100);
    else if (filterKey === 'passing') items = items.filter(i => i.rate === 100);

    const sorted = [...items];
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'rate_asc') sorted.sort((a, b) => a.rate - b.rate || a.name.localeCompare(b.name));
    else if (sortKey === 'rate_desc') sorted.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
    else if (sortKey === 'runs_desc') sorted.sort((a, b) => b.runs.length - a.runs.length || a.name.localeCompare(b.name));
    else if (sortKey === 'recent') sorted.sort((a, b) => b.mostRecent - a.mostRecent || a.name.localeCompare(b.name));
    return sorted;
  }, [testSummaries, filterKey, sortKey]);

  if (loading) return <LoadingSpinner message={t('trends.loading')} />;

  if (selectedTest) {
    const runs = testGroups.get(selectedTest) ?? [];
    return <TestDetail name={selectedTest} runs={runs} onBack={() => setSelectedTest(null)} />;
  }

  return (
    <div className="trends-page">
      <div className="section-header">
        <h2>{t('trends.title')}</h2>
        <div className="header-actions">
          <label className="trends-control">
            <span>{t('trends.filterLabel')}</span>
            <select className="input" value={filterKey} onChange={e => setFilterKey(e.target.value as FilterKey)}>
              <option value="all">{t('trends.filterAll')}</option>
              <option value="failing">{t('trends.filterFailing')}</option>
              <option value="flaky">{t('trends.filterFlaky')}</option>
              <option value="passing">{t('trends.filterPassing')}</option>
            </select>
          </label>
          <label className="trends-control">
            <span>{t('trends.sortLabel')}</span>
            <select className="input" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
              <option value="rate_asc">{t('trends.sortRateAsc')}</option>
              <option value="rate_desc">{t('trends.sortRateDesc')}</option>
              <option value="name">{t('trends.sortName')}</option>
              <option value="runs_desc">{t('trends.sortRunsDesc')}</option>
              <option value="recent">{t('trends.sortRecent')}</option>
            </select>
          </label>
        </div>
      </div>

      {testSummaries.length === 0 ? (
        <p className="empty-state">{t('trends.noData')}</p>
      ) : filteredSorted.length === 0 ? (
        <p className="empty-state">{t('trends.noMatchingTests')}</p>
      ) : (
        <div className="trends-card-grid">
          {filteredSorted.map(({ name, runs }) => (
            <TestCard
              key={name}
              name={name}
              runs={runs}
              onClick={() => setSelectedTest(name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DurationTrend {
  direction: 'slower' | 'faster' | 'stable';
  severity: 'minor' | 'major' | 'none';
  recentAvg: number;
  baselineAvg: number;
  percentChange: number;
}

function computeDurationTrend(runs: ReportSummary[]): DurationTrend {
  const passed = runs.filter(r => r.passed);
  // Need enough history on both sides to be meaningful
  if (passed.length < 5) {
    return { direction: 'stable', severity: 'none', recentAvg: 0, baselineAvg: 0, percentChange: 0 };
  }
  const recentCount = Math.min(3, Math.floor(passed.length / 2));
  const recent = passed.slice(-recentCount);
  const baseline = passed.slice(0, passed.length - recentCount);
  const avg = (xs: ReportSummary[]) => xs.reduce((s, r) => s + r.duration_seconds, 0) / xs.length;
  const recentAvg = avg(recent);
  const baselineAvg = avg(baseline);
  if (baselineAvg === 0) {
    return { direction: 'stable', severity: 'none', recentAvg, baselineAvg, percentChange: 0 };
  }
  const change = (recentAvg - baselineAvg) / baselineAvg;
  const absPct = Math.round(change * 100);

  if (Math.abs(change) < 0.15) {
    return { direction: 'stable', severity: 'none', recentAvg, baselineAvg, percentChange: absPct };
  }
  const direction = change > 0 ? 'slower' : 'faster';
  const severity = Math.abs(change) >= 0.30 ? 'major' : 'minor';
  return { direction, severity, recentAvg, baselineAvg, percentChange: absPct };
}

function TestCard({ name, runs, onClick }: { name: string; runs: ReportSummary[]; onClick: () => void }) {
  const { t } = useTranslation();
  const totalRuns = runs.length;
  const passCount = runs.filter(r => r.passed).length;
  const passRate = totalRuns > 0 ? Math.round((passCount / totalRuns) * 100) : 0;
  const passedRuns = runs.filter(r => r.passed);
  const avgDuration = passedRuns.length > 0
    ? Math.round(passedRuns.reduce((s, r) => s + r.duration_seconds, 0) / passedRuns.length * 10) / 10
    : 0;

  const trend = computeDurationTrend(runs);
  const showMajorSlowdown = trend.direction === 'slower' && trend.severity === 'major';

  const trendTooltip = trend.direction === 'stable'
    ? t('trends.durationStable')
    : t(trend.direction === 'slower' ? 'trends.durationSlowdown' : 'trends.durationSpeedup', {
        percent: trend.percentChange,
        recent: formatDuration(trend.recentAvg),
        baseline: formatDuration(trend.baselineAvg),
      });

  // Last 10 runs for status boxes
  const recent = runs.slice(-10);

  return (
    <div
      className={`trends-test-card${showMajorSlowdown ? ' trends-test-card-slowdown' : ''}`}
      onClick={onClick}
    >
      <div className="trends-test-card-header">
        <h3>{name}</h3>
        <span className={`trends-rate ${passRate === 100 ? 'rate-good' : passRate >= 75 ? 'rate-warn' : 'rate-bad'}`}>
          {passRate}%
        </span>
      </div>

      <div className="trends-duration-row" title={trendTooltip}>
        <span className="trends-duration-value">{formatDuration(avgDuration)}</span>
        <span className="trends-duration-label">{t('trends.avgDurationCol')}</span>
        {trend.direction === 'slower' && (
          <span className={`trends-duration-trend ${trend.severity === 'major' ? 'trend-bad' : 'trend-warn'}`}>
            <TrendingUp size={14} />
            {trend.percentChange}%
          </span>
        )}
        {trend.direction === 'faster' && (
          <span className="trends-duration-trend trend-good">
            <TrendingDown size={14} />
            {trend.percentChange}%
          </span>
        )}
      </div>

      <div className="trends-test-card-meta">
        {totalRuns} {t('trends.runs')}
      </div>
      <div className="trends-status-boxes">
        {recent.map((r, i) => (
          <div
            key={i}
            className={`status-box ${r.passed ? 'status-pass' : 'status-fail'}`}
            title={`${new Date(r.generated_at).toLocaleDateString()} — ${r.passed ? 'PASS' : 'FAIL'} (${formatDuration(r.duration_seconds)})`}
          />
        ))}
      </div>
    </div>
  );
}

function StatusDot(props: { cx?: number; cy?: number; payload?: { passed: boolean; date: string; duration: number } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const color = payload.passed ? '#22c55e' : '#ef4444';
  return (
    <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />
  );
}

function DurationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; duration: number; passed: boolean; stepsLabel: string } }> }) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="trends-tooltip">
      <div className="trends-tooltip-date">{data.label}</div>
      <div className="trends-tooltip-row">
        <span className={`badge-sm ${data.passed ? 'badge-pass' : 'badge-fail'}`}>
          {data.passed ? 'PASS' : 'FAIL'}
        </span>
        <span>{formatDuration(data.duration)}</span>
        <span className="text-muted">{data.stepsLabel}</span>
      </div>
    </div>
  );
}

function buildGradientStops(data: Array<{ passed: boolean }>): Array<{ offset: string; color: string }> {
  if (data.length < 2) return [];
  const stops: Array<{ offset: string; color: string }> = [];
  for (let i = 0; i < data.length; i++) {
    const pct = (i / (data.length - 1)) * 100;
    const color = data[i].passed ? '#22c55e' : '#ef4444';
    stops.push({ offset: `${pct}%`, color });
  }
  return stops;
}

function TestDetail({ name, runs, onBack }: { name: string; runs: ReportSummary[]; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const totalRuns = runs.length;
  const passCount = runs.filter(r => r.passed).length;
  const passRate = totalRuns > 0 ? Math.round((passCount / totalRuns) * 100) : 0;
  const passedRuns = runs.filter(r => r.passed);
  const avgDuration = passedRuns.length > 0
    ? Math.round(passedRuns.reduce((s, r) => s + r.duration_seconds, 0) / passedRuns.length * 10) / 10
    : 0;

  const chartData = runs.map((r, i) => {
    const d = new Date(r.generated_at);
    return {
      index: i,
      label: `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      duration: Math.round(r.duration_seconds * 10) / 10,
      passed: r.passed,
      stepsLabel: `${r.passed_count}/${r.total} steps`,
    };
  });

  const gradientStops = buildGradientStops(chartData);

  return (
    <div className="trends-page">
      <div className="section-header">
        <h2>{name}</h2>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>{t('trends.allTests')}</button>
      </div>

      {/* Overview cards */}
      <div className="trends-overview">
        <div className="trends-stat-card">
          <div className="trends-stat-value">{totalRuns}</div>
          <div className="trends-stat-label">{t('trends.totalRuns')}</div>
        </div>
        <div className="trends-stat-card">
          <div className={`trends-stat-value trends-rate ${passRate === 100 ? 'rate-good' : passRate >= 75 ? 'rate-warn' : 'rate-bad'}`}>{passRate}%</div>
          <div className="trends-stat-label">{t('trends.passRate')}</div>
        </div>
        <div className="trends-stat-card">
          <div className="trends-stat-value">{formatDuration(avgDuration)}</div>
          <div className="trends-stat-label">{t('trends.avgDuration')}</div>
        </div>
      </div>

      {/* Run history table */}
      <div className="trends-section">
        <h3>{t('trends.runHistory')}</h3>
        <div className="trends-table-wrapper">
          <table className="trends-table">
            <thead>
              <tr>
                <th>{t('trends.date')}</th>
                <th>{t('trends.status')}</th>
                <th>{t('trends.duration')}</th>
                <th>{t('trends.steps')}</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r, i) => (
                <tr key={i} className="trends-table-row" onClick={() => navigate(`/reports/${r.report_id}`)}>
                  <td>{new Date(r.generated_at).toLocaleString()}</td>
                  <td>
                    <span className={`badge-sm ${r.passed ? 'badge-pass' : 'badge-fail'}`}>
                      {r.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                  <td>{formatDuration(r.duration_seconds)}</td>
                  <td>{r.passed_count}/{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duration chart with gradient line and color-coded dots */}
      <div className="trends-section">
        <h3>{t('trends.durationHistory')}</h3>
        <div className="trends-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="statusGradient" x1="0" y1="0" x2="1" y2="0">
                  {gradientStops.map((stop, i) => (
                    <stop key={i} offset={stop.offset} stopColor={stop.color} />
                  ))}
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10 }}
                tickFormatter={(i: number) => chartData[i]?.label ?? ''}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} unit="s" />
              <Tooltip content={<DurationTooltip />} />
              <Line
                type="monotone"
                dataKey="duration"
                stroke="url(#statusGradient)"
                strokeWidth={2.5}
                dot={<StatusDot />}
                activeDot={<StatusDot />}
                name={t('trends.duration')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
