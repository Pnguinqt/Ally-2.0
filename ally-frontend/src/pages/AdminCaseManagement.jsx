import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { caseService } from '../services/caseService.jsx';

const itemsPerPage = 15;

const formatLabel = (value) => {
  if (!value) return 'Not specified';
  return String(value)
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const statusStyle = (status) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'ACCEPTED':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'DECLINED':
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-200';
  }
};

const urgencyStyle = (urgency) => {
  switch (urgency) {
    case 'HIGH':
    case 'URGENT':
      return 'text-rose-700 bg-rose-50';
    case 'MEDIUM':
      return 'text-amber-700 bg-amber-50';
    case 'LOW':
      return 'text-emerald-700 bg-emerald-50';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const AdminCaseManagement = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [caseType, setCaseType] = useState('');
  const [urgency, setUrgency] = useState('');
  const [assignment, setAssignment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await caseService.getAdminCaseOverview();
      setCases(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the case overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const caseTypes = useMemo(() => (
    [...new Set(cases.map((caseItem) => caseItem.caseType).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
  ), [cases]);

  const urgencyOptions = useMemo(() => (
    [...new Set(cases.map((caseItem) => caseItem.urgencyLevel).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
  ), [cases]);

  const summary = useMemo(() => ({
    total: cases.length,
    open: cases.filter((caseItem) => ['PENDING', 'ACCEPTED'].includes(caseItem.status)).length,
    completed: cases.filter((caseItem) => caseItem.status === 'COMPLETED').length,
    unassigned: cases.filter((caseItem) => !caseItem.lawyerAssigned).length,
  }), [cases]);

  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter((caseItem) => {
      const matchesSearch = !term || [caseItem.caseNumber, caseItem.caseType, caseItem.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = !status || caseItem.status === status;
      const matchesType = !caseType || caseItem.caseType === caseType;
      const matchesUrgency = !urgency || (urgency === 'NOT_SPECIFIED' ? !caseItem.urgencyLevel : caseItem.urgencyLevel === urgency);
      const matchesAssignment = !assignment || (assignment === 'assigned' ? caseItem.lawyerAssigned : !caseItem.lawyerAssigned);
      return matchesSearch && matchesStatus && matchesType && matchesUrgency && matchesAssignment;
    });
  }, [cases, search, status, caseType, urgency, assignment]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, caseType, urgency, assignment]);

  const pageStart = (currentPage - 1) * itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / itemsPerPage));
  const currentCases = filteredCases.slice(pageStart, pageStart + itemsPerPage);
  const hasFilters = Boolean(search || status || caseType || urgency || assignment);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCaseType('');
    setUrgency('');
    setAssignment('');
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <BriefcaseBusiness className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Case Management</h1>
            <p className="mt-1 text-sm text-gray-600">Monitor case activity using limited operational information.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadCases}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh cases
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">Privacy-protected overview</h2>
          <p className="mt-1 text-sm leading-6 text-blue-800">
            Case titles, descriptions, participant identities, documents, and messages are intentionally excluded. Administrators can only view the operational metadata needed to monitor the system.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total cases" value={summary.total} icon={BriefcaseBusiness} color="blue" />
        <MetricCard label="Open cases" value={summary.open} icon={Clock3} color="amber" />
        <MetricCard label="Completed" value={summary.completed} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Unassigned" value={summary.unassigned} icon={UserX} color="rose" />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900">Filter cases</h2>
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>}
        </div>

        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
          <label className="block w-80 shrink-0 xl:min-w-80 xl:flex-1">
            <span className="sr-only">Search cases</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case number or category" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          </label>
          <CaseSelect label="Status" value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            {['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'].map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </CaseSelect>
          <CaseSelect label="Category" value={caseType} onChange={setCaseType}>
            <option value="">All categories</option>
            {caseTypes.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </CaseSelect>
          <CaseSelect label="Urgency" value={urgency} onChange={setUrgency}>
            <option value="">All urgency</option>
            {urgencyOptions.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
            <option value="NOT_SPECIFIED">Not specified</option>
          </CaseSelect>
          <CaseSelect label="Assignment" value={assignment} onChange={setAssignment}>
            <option value="">All assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </CaseSelect>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-semibold text-gray-900">System case overview</h2>
            <p className="mt-0.5 text-sm text-gray-500">Restricted metadata only—full case access is unavailable.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{filteredCases.length} cases</span>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center" role="status">
            <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm font-medium text-gray-600">Loading case overview...</p></div>
          </div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
            <h3 className="mt-3 font-semibold text-gray-900">Unable to load cases</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button type="button" onClick={loadCases} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Try again</button>
          </div>
        ) : currentCases.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-gray-400" />
            <h3 className="mt-3 font-semibold text-gray-900">No cases found</h3>
            <p className="mt-1 text-sm text-gray-500">Try changing or clearing the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Case</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Urgency</th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Assignment</th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Submitted</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentCases.map((caseItem) => (
                  <tr key={caseItem.caseId} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-4"><div className="font-semibold text-gray-900">Case #{caseItem.caseNumber || caseItem.caseId}</div><div className="mt-0.5 text-xs text-gray-500">System ID {caseItem.caseId}</div></td>
                    <td className="px-5 py-4 font-medium text-gray-700">{formatLabel(caseItem.caseType)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle(caseItem.status)}`}>{formatLabel(caseItem.status)}</span></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${urgencyStyle(caseItem.urgencyLevel)}`}>{formatLabel(caseItem.urgencyLevel)}</span></td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${caseItem.lawyerAssigned ? 'text-emerald-700' : 'text-gray-500'}`}>
                        {caseItem.lawyerAssigned ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}{caseItem.lawyerAssigned ? 'Assigned' : 'Unassigned'}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 text-gray-600 lg:table-cell">{formatDate(caseItem.dateSubmitted)}</td>
                    <td className="px-5 py-4 text-right"><span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500"><LockKeyhole className="h-3.5 w-3.5" />Restricted</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredCases.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-gray-600">Showing <span className="font-medium text-gray-900">{pageStart + 1}</span>–<span className="font-medium text-gray-900">{Math.min(pageStart + itemsPerPage, filteredCases.length)}</span> of <span className="font-medium text-gray-900">{filteredCases.length}</span></p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage((page) => page - 1)} disabled={currentPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => page + 1)} disabled={currentPage === totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color }) => {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    rose: 'border-rose-200 bg-rose-50 text-rose-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-600">{label}</p><p className="mt-1 text-3xl font-bold text-gray-900">{value}</p></div><div className={`rounded-lg border p-2.5 ${colors[color]}`}>{React.createElement(icon, { className: 'h-5 w-5', 'aria-hidden': true })}</div></div>
    </div>
  );
};

const CaseSelect = ({ label, value, onChange, children }) => (
  <label className="block w-40 shrink-0"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{children}</select></label>
);

export default AdminCaseManagement;
