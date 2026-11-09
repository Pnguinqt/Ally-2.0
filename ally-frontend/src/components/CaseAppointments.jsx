import { useEffect, useState } from 'react';
import { AlertCircle, BriefcaseBusiness, CalendarDays, Clock3, Loader2, Plus, RefreshCw, UserRound } from 'lucide-react';
import { caseService as productionCaseService } from '../services/caseService.jsx';
import { hearingService as productionHearingService } from '../services/hearingService.js';
import { useDemoRuntime } from '../demo/DemoContext';
import { formatHearingDate, formatHearingTime } from '../utils/hearingDates.js';
import { HEARING_LOAD_TIMEOUT_MS, readHearingSchedule } from '../utils/hearingSchedule.js';
import useAppointmentPolling from '../hooks/useAppointmentPolling.js';
import AppointmentProposalForm from './AppointmentProposalForm.jsx';
import AppointmentActions from './AppointmentActions.jsx';
import AppointmentMeetingDetails from './AppointmentMeetingDetails.jsx';

export default function CaseAppointments({ authData }) {
  const demo = useDemoRuntime();
  const caseService = demo?.caseService || productionCaseService;
  const hearingService = demo?.hearingService || productionHearingService;
  const userId = authData?.userId;
  const isLawyer = authData?.accountType === 'LAWYER';
  const [appointments, setAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState('upcoming');
  const [caseFilter, setCaseFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const finish = () => {
      setNow(Date.now());
      setLoading(false);
      setRefreshing(false);
    };
    const timeout = window.setTimeout(() => {
      controller.abort();
      setError('Some case appointments took too long to load. Refresh to try again.');
      finish();
    }, HEARING_LOAD_TIMEOUT_MS);
    const load = async () => {
      setRefreshing(true);
      setError('');
      try {
        if (!userId) throw new Error('Please sign in to view your case appointments.');
        const clientCases = isLawyer ? await caseService.getLawyerCases(userId, signal) : await caseService.getClientCases(userId, signal);
        if (signal.aborted) return;
        const caseIds = new Set(clientCases.map(item => item.caseId));
        setCases(clientCases);
        setAppointments(current => current.filter(item => caseIds.has(item.legalCase.caseId)));
        // Case membership is enforced by the appointment endpoints for both roles.
        const results = await Promise.allSettled(clientCases.map(async legalCase => {
          const response = await hearingService.list(legalCase.caseId, signal);
          const { appointments, incomplete } = readHearingSchedule(response);
          const caseAppointments = appointments.map(hearing => ({ ...hearing, legalCase }));
          if (!signal.aborted) {
            setAppointments(current => [
              ...current.filter(item => item.legalCase.caseId !== legalCase.caseId), ...caseAppointments,
            ]);
            if (caseAppointments.length) setLoading(false);
          }
          return { appointments: caseAppointments, incomplete };
        }));
        if (signal.aborted) return;
        setAppointments(results.flatMap(result => result.status === 'fulfilled' ? result.value.appointments : []));
        if (results.some(result => result.status === 'rejected' || result.value.incomplete)) {
          setError('Some case appointments could not be loaded. Refresh to try again.');
        }
      } catch (err) {
        if (!signal.aborted) {
          setAppointments([]);
          setCases([]);
          setError(err.message || 'Unable to load your appointments. Please try again.');
        }
      } finally {
        window.clearTimeout(timeout);
        if (!signal.aborted) finish();
      }
    };
    load();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [userId, isLawyer, caseService, hearingService, refresh]);

  useAppointmentPolling(!refreshing && !error, setRefresh);

  const scoped = appointments.filter(item => caseFilter === 'all' || String(item.legalCase.caseId) === caseFilter);
  const upcoming = scoped.filter(item => item.status !== 'PENDING' && new Date(item.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = scoped.filter(item => new Date(item.status === 'PENDING' ? item.startsAt : item.endsAt).getTime() <= now)
    .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
  const pending = scoped.filter(item => item.status === 'PENDING' && new Date(item.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const visible = view === 'upcoming' ? upcoming : view === 'pending' ? pending : past;
  const next = upcoming[0];
  const activeCases = cases.filter(item => item.status === 'ACCEPTED' && item.lawyer && item.client);
  const refreshList = () => setRefresh(value => value + 1);

  return (
    <div className="max-w-6xl px-4 py-6 mx-auto sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-blue-600 uppercase">Your case schedule</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Appointments</h1>
          <p className="mt-2 text-sm text-gray-500">Propose a time for your case. Confirm together with the other participant.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button type="button" disabled={refreshing} onClick={refreshList}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </button>
        <button type="button" disabled={loading || activeCases.length === 0} onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg disabled:opacity-50">
          <Plus className="w-4 h-4" />Propose appointment
        </button>
        </div>
      </header>
      {showForm && <AppointmentProposalForm cases={activeCases} appointment={editing}
        onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); setEditing(null); setView('pending'); refreshList(); }} />}
      {!loading && activeCases.length === 0 && !error && <p className="mb-4 text-sm text-gray-500">You can propose appointments once you have an accepted case with a client and assigned lawyer.</p>}

      {error && <div role="alert" className="flex items-start gap-2 p-4 mb-5 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">
        <AlertCircle className="w-5 h-5 shrink-0" /><p>{error}</p>
      </div>}

      {!loading && next && (
        <section aria-labelledby="next-appointment-heading" className="p-5 mb-6 border border-blue-100 rounded-2xl bg-blue-50 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-blue-700 uppercase">
            <CalendarDays className="w-4 h-4" />
            <h2 id="next-appointment-heading">{new Date(next.startsAt).getTime() <= now ? 'Happening now' : 'Next appointment'}</h2>
          </div>
          <div className="grid gap-4 mt-3 sm:grid-cols-2">
            <div>
              <p className="text-xl font-semibold text-gray-900 break-words">{next.title}</p>
              <p className="mt-2 text-sm text-blue-800 break-words">Case #{next.legalCase.caseId} · {next.legalCase.title}</p>
            </div>
            <div className="sm:border-l sm:border-blue-200 sm:pl-6">
              <p className="font-semibold text-gray-900">{formatHearingDate(next.startsAt)}</p>
              <p className="mt-1 text-sm text-gray-600">{formatHearingTime(next.startsAt)} – {formatHearingTime(next.endsAt)}</p>
              <div className="mt-2"><AppointmentMeetingDetails appointment={next} /></div>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Case appointments" className="overflow-hidden bg-white border border-gray-200 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-100 sm:px-6">
          <div className="flex gap-1 p-1 rounded-lg bg-gray-100" aria-label="Appointment period">
            {[['upcoming', 'Upcoming', upcoming.length], ['pending', 'Proposals', pending.length], ['past', 'Past', past.length]].map(([value, label, count]) => (
              <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                {label}<span className="ml-2 text-xs">{loading ? '…' : count}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <span>Case</span>
            <select value={caseFilter} onChange={event => setCaseFilter(event.target.value)}
              className="max-w-[220px] p-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500">
              <option value="all">All cases</option>
              {cases.map(item => <option key={item.caseId} value={String(item.caseId)}>#{item.caseId} · {item.title || 'Untitled case'}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-3 p-16 text-sm text-gray-500">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />Loading case appointments…
          </div>
        ) : visible.length === 0 && refreshing ? (
          <p role="status" className="p-6 text-center text-sm text-gray-500">Updating case appointments…</p>
        ) : visible.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="flex items-center justify-center mx-auto mb-4 rounded-full h-14 w-14 bg-gray-50"><CalendarDays className="w-6 h-6 text-gray-400" /></div>
            <h2 className="text-lg font-semibold text-gray-900">{error ? 'Schedule unavailable' : view === 'pending' ? 'No pending proposals' : view === 'past' ? 'No past appointments' : 'No upcoming appointments'}</h2>
            <p className="max-w-sm mx-auto mt-2 text-sm leading-6 text-gray-500">
              {error ? 'Refresh to load the complete schedule.' : view === 'past' ? 'Past case appointments will appear here.' : view === 'pending' ? 'Proposals from you and the other participant will appear here.' : 'Propose an appointment for an accepted case. Once the other participant accepts, it appears here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map(item => <AppointmentRow key={`${item.legalCase.caseId}-${item.hearingId}`} item={item} now={now}
              isLawyer={isLawyer} userId={userId} onChange={refreshList} onEdit={() => { setEditing(item); setShowForm(true); }} />)}
          </div>
        )}
        <p className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100 bg-gray-50 sm:px-6">All times are Philippine time (UTC+8). Editing an appointment sends a new proposal for the other participant to accept.</p>
      </section>
    </div>
  );
}

function AppointmentRow({ item, now, isLawyer, userId, onChange, onEdit }) {
  const lawyer = isLawyer ? item.legalCase.client : item.legalCase.lawyer;
  const lawyerName = [lawyer?.Fname || lawyer?.fname, lawyer?.Lname || lawyer?.lname].filter(Boolean).join(' ');
  const pending = item.status === 'PENDING';
  const ended = new Date(pending ? item.startsAt : item.endsAt).getTime() <= now;
  const inProgress = !ended && new Date(item.startsAt).getTime() <= now;

  return (
    <article className="grid gap-4 p-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6 sm:p-6">
      <div>
        <p className="text-sm font-semibold text-gray-900">{formatHearingDate(item.startsAt)}</p>
        <p className="flex items-center gap-1.5 mt-2 text-xs text-gray-500"><Clock3 className="w-3.5 h-3.5" />{formatHearingTime(item.startsAt)} – {formatHearingTime(item.endsAt)}</p>
        <span className={`inline-block mt-3 rounded-full px-2.5 py-1 text-xs font-medium ${ended ? 'bg-gray-100 text-gray-600' : inProgress ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {ended ? pending ? 'Expired proposal' : 'Past' : pending ? 'Pending acceptance' : inProgress ? 'In progress' : 'Upcoming'}
        </span>
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900 break-words">{item.title}</h2>
        <p className="flex items-start gap-2 mt-2 text-sm text-blue-700"><BriefcaseBusiness className="w-4 h-4 mt-0.5 shrink-0" /><span className="break-words">Case #{item.legalCase.caseId} · {item.legalCase.title || 'Untitled case'}</span></p>
        <div className="grid gap-2 mt-3 text-sm text-gray-500 md:grid-cols-2">
          <AppointmentMeetingDetails appointment={item} />
          <p className="flex items-start gap-2"><UserRound className="w-4 h-4 mt-0.5 shrink-0" /><span>{lawyerName || (isLawyer ? 'Client' : 'Assigned lawyer')}</span></p>
        </div>
        {item.notes && <div className="p-3 mt-4 rounded-lg bg-gray-50">
          <p className="text-xs font-semibold text-gray-600">Appointment notes</p>
          <p className="mt-1 text-sm leading-6 text-gray-500 whitespace-pre-wrap break-words">{item.notes}</p>
        </div>}
        <AppointmentActions appointment={item} caseInfo={item.legalCase} userId={userId} onEdit={onEdit} onChange={onChange} />
      </div>
    </article>
  );
}
