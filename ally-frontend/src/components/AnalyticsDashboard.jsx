import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BriefcaseBusiness,
  RefreshCw,
  Users
} from 'lucide-react';
import { adminService } from '../services/adminService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '0', label: 'All time' }
];

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'client', label: 'Clients' },
  { value: 'lawyer', label: 'Lawyers' },
  { value: 'admin', label: 'Admins' }
];

const formatNumber = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);

const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState('30');
  const [filterRole, setFilterRole] = useState('all');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async ({ background = false } = {}) => {
    try {
      background ? setRefreshing(true) : setLoading(true);
      setError('');
      const data = await adminService.getAnalytics({
        days: Number(dateRange),
        role: filterRole
      });
      setAnalytics(data);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, filterRole]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, padding: 18 }
      },
      tooltip: { displayColors: true }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(148, 163, 184, 0.18)' }
      },
      x: { grid: { display: false } }
    }
  }), []);

  const userActivityData = useMemo(() => ({
    labels: analytics?.userRegistrations?.map(point => point.label) ?? [],
    datasets: [{
      label: 'New registrations',
      data: analytics?.userRegistrations?.map(point => point.registrations) ?? [],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      fill: true,
      tension: 0.35
    }]
  }), [analytics]);

  const caseActivityData = useMemo(() => ({
    labels: analytics?.caseActivity?.map(point => point.label) ?? [],
    datasets: [
      {
        label: 'Cases submitted',
        data: analytics?.caseActivity?.map(point => point.submitted) ?? [],
        backgroundColor: 'rgb(16, 185, 129)'
      },
      {
        label: 'Currently completed',
        data: analytics?.caseActivity?.map(point => point.completed) ?? [],
        backgroundColor: 'rgb(99, 102, 241)'
      }
    ]
  }), [analytics]);

  const roleDistributionData = useMemo(() => ({
    labels: Object.keys(analytics?.userRoleDistribution ?? {}),
    datasets: [{
      label: 'Users',
      data: Object.values(analytics?.userRoleDistribution ?? {}),
      backgroundColor: ['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(139, 92, 246)'],
      borderRadius: 6
    }]
  }), [analytics]);

  const caseStatusData = useMemo(() => ({
    labels: Object.keys(analytics?.caseStatusDistribution ?? {}),
    datasets: [{
      label: 'Cases',
      data: Object.values(analytics?.caseStatusDistribution ?? {}),
      backgroundColor: [
        'rgb(245, 158, 11)',
        'rgb(59, 130, 246)',
        'rgb(239, 68, 68)',
        'rgb(16, 185, 129)',
        'rgb(148, 163, 184)'
      ],
      borderRadius: 6
    }]
  }), [analytics]);

  const lawyerPerformanceData = useMemo(() => ({
    labels: analytics?.lawyerPerformance?.map(lawyer => lawyer.lawyerName) ?? [],
    datasets: [{
      label: 'Cases handled',
      data: analytics?.lawyerPerformance?.map(lawyer => lawyer.casesHandled) ?? [],
      backgroundColor: 'rgba(249, 115, 22, 0.8)',
      borderRadius: 6
    }]
  }), [analytics]);

  if (loading) {
    return <AnalyticsLoadingState />;
  }

  if (error && !analytics) {
    return <AnalyticsErrorState message={error} onRetry={() => loadAnalytics()} />;
  }

  const metrics = analytics?.metrics ?? {};
  const statsCards = [
    {
      label: filterRole === 'all' ? 'Total Users' : `Total ${ROLE_OPTIONS.find(option => option.value === filterRole)?.label}`,
      value: formatNumber(metrics.totalUsers),
      change: metrics.userGrowthPercent,
      changeUnit: '%',
      changeLabel: 'registrations vs previous period',
      icon: Users,
      color: 'blue'
    },
    {
      label: 'New Cases',
      value: formatNumber(metrics.newCases),
      change: metrics.caseGrowthPercent,
      changeUnit: '%',
      changeLabel: 'vs previous period',
      icon: BriefcaseBusiness,
      color: 'emerald'
    },
    {
      label: 'Case Completion Rate',
      value: `${metrics.caseCompletionRate ?? 0}%`,
      change: metrics.completionRateChange,
      changeUnit: ' pp',
      changeLabel: 'vs previous period',
      icon: BadgeCheck,
      color: 'violet'
    },
    {
      label: 'Pending Verifications',
      value: formatNumber(metrics.pendingVerifications),
      icon: AlertCircle,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Live platform activity and case outcomes</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="analytics-date-range">Date range</label>
          <select
            id="analytics-date-range"
            value={dateRange}
            onChange={event => setDateRange(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="analytics-role">Account role</label>
          <select
            id="analytics-role"
            value={filterRole}
            onChange={event => setFilterRole(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => loadAnalytics({ background: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          {error}. Showing the most recently loaded data.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsCards.map(stat => <StatCard key={stat.label} {...stat} showChange={dateRange !== '0'} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="User Registration Trend" description="New accounts created in the selected period">
          <Line data={userActivityData} options={chartOptions} />
        </ChartCard>
        <ChartCard title="Case Activity" description="Cases grouped by their submission date">
          <Bar data={caseActivityData} options={chartOptions} />
        </ChartCard>
        <ChartCard title="Users by Role" description="Current account distribution across the platform">
          <Bar data={roleDistributionData} options={chartOptions} />
        </ChartCard>
        <ChartCard title="Cases by Status" description="Current status of all cases">
          <Bar data={caseStatusData} options={chartOptions} />
        </ChartCard>
      </div>

      <ChartCard title="Lawyer Workload" description="Lawyers ranked by recorded cases handled" tall>
        <Bar data={lawyerPerformanceData} options={chartOptions} />
      </ChartCard>

      <p className="text-right text-xs text-gray-500">
        Last updated {analytics?.generatedAt ? new Date(analytics.generatedAt).toLocaleString('en-PH') : '—'}
      </p>
    </div>
  );
};

const StatCard = ({ label, value, change, changeUnit = '', changeLabel, icon, color, showChange }) => {
  const isPositive = Number(change) >= 0;
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${colorClasses[color]}`}>
          {React.createElement(icon, { className: 'h-5 w-5' })}
        </div>
      </div>
      {showChange && change !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          <span>{Math.abs(Number(change))}{changeUnit} {changeLabel}</span>
        </div>
      )}
    </div>
  );
};

const ChartCard = ({ title, description, children, tall = false }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
    <div className={tall ? 'h-[360px]' : 'h-[300px]'}>{children}</div>
  </section>
);

const AnalyticsLoadingState = () => (
  <div className="space-y-6 p-6" aria-label="Loading analytics">
    <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map(item => <div key={item} className="h-32 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {[0, 1, 2, 3].map(item => <div key={item} className="h-80 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  </div>
);

const AnalyticsErrorState = ({ message, onRetry }) => (
  <div className="m-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
    <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
    <h2 className="text-lg font-semibold text-red-900">Unable to load analytics</h2>
    <p className="mt-2 max-w-lg text-sm text-red-700">{message}</p>
    <button type="button" onClick={onRetry} className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
      Try again
    </button>
  </div>
);

export default AnalyticsDashboard;
