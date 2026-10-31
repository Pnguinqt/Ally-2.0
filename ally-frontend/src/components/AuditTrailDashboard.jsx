import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { auditService } from '../services/auditService';

const moduleOptions = ['', 'AUTH', 'CASE', 'DOCUMENT', 'AI', 'AI_CHAT_HISTORY'];
const actionOptions = [
  '',
  'LOGIN',
  'CREATE_CASE',
  'EDIT_CASE',
  'ACCEPT_CASE',
  'DECLINE_CASE',
  'DELETE_CASE',
  'UPDATE_CASE_STATUS',
  'UPLOAD_DOCUMENT',
  'DELETE_DOCUMENT',
  'SUMMARIZE_DOCUMENT',
  'AI_QUERY',
  'DELETE_AI_CHAT',
];

const formatLabel = (value) => {
  if (!value) return 'Not available';
  return String(value)
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getDateParts = (value) => {
  if (!value) return { date: 'Unknown date', time: 'Unknown time', full: 'Not available' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: 'Unknown date', time: 'Unknown time', full: String(value) };

  return {
    date: new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed),
    time: new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(parsed),
    full: new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeStyle: 'medium',
    }).format(parsed),
  };
};

const getModuleStyle = (moduleName) => {
  switch (moduleName) {
    case 'AUTH':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    case 'CASE':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'DOCUMENT':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'AI':
    case 'AI_CHAT_HISTORY':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-200';
  }
};

const getStatusStyle = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (normalized === 'PENDING') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  return 'bg-rose-50 text-rose-700 ring-rose-200';
};

const isSuccessful = (status) => ['SUCCESS', 'COMPLETED'].includes(String(status || '').toUpperCase());

const getActorInitials = (email) => {
  if (!email) return 'SY';
  const localPart = email.split('@')[0];
  const pieces = localPart.split(/[._-]/).filter(Boolean);
  return pieces.slice(0, 2).map((piece) => piece[0]).join('').toUpperCase() || 'US';
};

const AuditTrailDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const itemsPerPage = 15;

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await auditService.getAuditLogs({ moduleName, action, limit: 500 });
      setLogs(data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [moduleName, action]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    const rangeInMilliseconds = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeRange];

    return logs.filter((log) => {
      const matchesSearch = !term || [
        log.auditId,
        log.actorEmail,
        log.actorRole,
        log.actorId,
        log.action,
        log.moduleName,
        log.targetType,
        log.targetId,
        log.description,
        log.status,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(term));

      const matchesStatus = !status || String(log.status || '').toUpperCase() === status;
      const matchesRole = !actorRole || String(log.actorRole || 'SYSTEM').toUpperCase() === actorRole;
      const timestamp = new Date(log.createdAt).getTime();
      const matchesTime = !rangeInMilliseconds || (!Number.isNaN(timestamp) && now - timestamp <= rangeInMilliseconds);

      return matchesSearch && matchesStatus && matchesRole && matchesTime;
    });
  }, [logs, search, status, actorRole, timeRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [moduleName, action, status, actorRole, timeRange, search]);

  const summary = useMemo(() => {
    const successful = filteredLogs.filter((log) => isSuccessful(log.status)).length;
    const flagged = filteredLogs.length - successful;
    const actors = new Set(filteredLogs.map((log) => log.actorId || log.actorEmail).filter(Boolean)).size;
    return { successful, flagged, actors };
  }, [filteredLogs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const pageStart = (currentPage - 1) * itemsPerPage;
  const currentLogs = filteredLogs.slice(pageStart, pageStart + itemsPerPage);
  const hasFilters = Boolean(moduleName || action || status || actorRole || search || timeRange !== 'all');

  const clearFilters = () => {
    setModuleName('');
    setAction('');
    setStatus('');
    setActorRole('');
    setTimeRange('all');
    setSearch('');
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Trail</h1>
            <p className="mt-1 text-sm text-gray-600">Investigate account activity, case changes, document events, and AI usage.</p>
            {lastRefreshed && <p className="mt-1 text-xs text-gray-400">Last refreshed {getDateParts(lastRefreshed).time}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh records
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Events shown" value={filteredLogs.length} icon={Activity} color="blue" />
        <SummaryCard label="Successful" value={summary.successful} icon={CheckCircle2} color="emerald" />
        <SummaryCard label="Flagged events" value={summary.flagged} icon={AlertCircle} color="rose" />
        <SummaryCard label="Unique actors" value={summary.actors} icon={UsersRound} color="violet" />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Audit filters">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900">Filter activity</h2>
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>}
        </div>

        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
          <label className="block w-80 shrink-0 xl:min-w-80 xl:flex-1">
            <span className="sr-only">Search audit records</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search actor, event ID, target, or description"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </label>

          <AuditSelect label="Module" value={moduleName} onChange={setModuleName}>
            {moduleOptions.map((option) => <option key={option || 'ALL'} value={option}>{option ? formatLabel(option) : 'All modules'}</option>)}
          </AuditSelect>
          <AuditSelect label="Action" value={action} onChange={setAction}>
            {actionOptions.map((option) => <option key={option || 'ALL'} value={option}>{option ? formatLabel(option) : 'All actions'}</option>)}
          </AuditSelect>
          <AuditSelect label="Status" value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="ERROR">Error</option>
          </AuditSelect>
          <AuditSelect label="Actor role" value={actorRole} onChange={setActorRole}>
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="LAWYER">Lawyer</option>
            <option value="CLIENT">Client</option>
            <option value="SYSTEM">System</option>
          </AuditSelect>
          <AuditSelect label="Time range" value={timeRange} onChange={setTimeRange}>
            <option value="all">All time</option>
            <option value="24h">Past 24 hours</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
          </AuditSelect>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-semibold text-gray-900">Activity records</h2>
            <p className="mt-0.5 text-sm text-gray-500">Showing the most recent matching events.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{filteredLogs.length} records</span>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center" role="status">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-gray-600">Loading audit records...</p>
            </div>
          </div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-600" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-gray-900">Unable to load audit records</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button type="button" onClick={loadLogs} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Try again</button>
          </div>
        ) : currentLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-gray-900">No audit records found</h3>
            <p className="mt-1 text-sm text-gray-500">Try changing or clearing the current filters.</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Event</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actor</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Activity</th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Target</th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">Description</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentLogs.map((log) => {
                  const date = getDateParts(log.createdAt);
                  return (
                    <tr key={log.auditId} className="transition hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="font-semibold text-gray-900">{date.date}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{date.time} · ID #{log.auditId}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-48 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{getActorInitials(log.actorEmail)}</div>
                          <div className="min-w-0">
                            <div className="max-w-56 truncate font-medium text-gray-900">{log.actorEmail || 'System event'}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{formatLabel(log.actorRole || 'SYSTEM')}{log.actorId ? ` · User #${log.actorId}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getModuleStyle(log.moduleName)}`}>{formatLabel(log.moduleName)}</span>
                        <div className="mt-1.5 whitespace-nowrap font-medium text-gray-800">{formatLabel(log.action)}</div>
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        <div className="font-medium text-gray-800">{formatLabel(log.targetType)}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{log.targetId ? `ID #${log.targetId}` : 'No target ID'}</div>
                      </td>
                      <td className="hidden max-w-sm px-5 py-4 text-gray-600 xl:table-cell">
                        <p className="line-clamp-2 leading-5">{log.description || 'No description provided.'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyle(log.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isSuccessful(log.status) ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {formatLabel(log.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => setSelectedLog(log)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={`View audit event ${log.auditId}`}>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredLogs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-900">{pageStart + 1}</span>–<span className="font-medium text-gray-900">{Math.min(pageStart + itemsPerPage, filteredLogs.length)}</span> of <span className="font-medium text-gray-900">{filteredLogs.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage((page) => page - 1)} disabled={currentPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => page + 1)} disabled={currentPage === totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>

      {selectedLog && <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color }) => {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    rose: 'border-rose-200 bg-rose-50 text-rose-600',
    violet: 'border-violet-200 bg-violet-50 text-violet-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-gray-600">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{value}</p></div>
        <div className={`rounded-lg border p-2.5 ${colors[color]}`}>{React.createElement(icon, { className: 'h-5 w-5', 'aria-hidden': true })}</div>
      </div>
    </div>
  );
};

const AuditSelect = ({ label, value, onChange, children, extraClass = '' }) => (
  <label className={`block w-40 shrink-0 ${extraClass}`}>
    <span className="sr-only">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{children}</select>
  </label>
);

const AuditDetailModal = ({ log, onClose }) => {
  const date = getDateParts(log.createdAt);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div>
            <div><h2 id="audit-detail-title" className="text-lg font-semibold text-gray-900">Audit event #{log.auditId}</h2><p className="mt-1 text-sm text-gray-500">{date.full}</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close audit details"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailCard label="Module" value={formatLabel(log.moduleName)} />
            <DetailCard label="Action" value={formatLabel(log.action)} />
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyle(log.status)}`}>
                {isSuccessful(log.status) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{formatLabel(log.status)}
              </span>
            </div>
          </div>

          <section className="rounded-xl border border-gray-200 p-5">
            <div className="mb-4 flex items-center gap-2"><UserRound className="h-4 w-4 text-blue-600" /><h3 className="font-semibold text-gray-900">Actor information</h3></div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Email" value={log.actorEmail || 'System event'} />
              <DetailItem label="Role" value={formatLabel(log.actorRole || 'SYSTEM')} />
              <DetailItem label="User ID" value={log.actorId ? `#${log.actorId}` : 'Not applicable'} />
              <DetailItem label="Recorded at" value={date.full} />
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 p-5">
            <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /><h3 className="font-semibold text-gray-900">Event context</h3></div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Target type" value={formatLabel(log.targetType)} />
              <DetailItem label="Target ID" value={log.targetId ? `#${log.targetId}` : 'Not applicable'} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</dt>
                <dd className="mt-2 rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-700">{log.description || 'No description was recorded for this event.'}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">Close</button>
        </div>
      </div>
    </div>
  );
};

const DetailCard = ({ label, value }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-sm font-semibold text-gray-900">{value}</p></div>
);

const DetailItem = ({ label, value }) => (
  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium text-gray-900">{value}</dd></div>
);

export default AuditTrailDashboard;
