import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Calendar } from './ui/calendar.jsx';
import AppointmentProposalForm from './AppointmentProposalForm.jsx';
import AppointmentActions from './AppointmentActions.jsx';
import AppointmentMeetingDetails from './AppointmentMeetingDetails.jsx';
import { hearingService as productionHearingService } from '../services/hearingService.js';
import { useDemoRuntime } from '../demo/DemoContext';
import { calendarDate, calendarDateKey, formatHearingDate, formatHearingTime, hearingDateKey, hearingInstant } from '../utils/hearingDates.js';

export default function CaseHearingCalendar({ caseInfo, authData }) {
  const demo = useDemoRuntime();
  const hearingService = demo?.hearingService || productionHearingService;
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [month, setMonth] = useState(() => calendarDate(hearingDateKey()));
  const [selectedDate, setSelectedDate] = useState();
  const [view, setView] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const canBook = caseInfo.status === 'ACCEPTED' && (
    authData.accountType === 'LAWYER' && Number(caseInfo.lawyer?.userId) === Number(authData.userId)
    || authData.accountType === 'CLIENT' && Number(caseInfo.client?.userId) === Number(authData.userId));

  useEffect(() => {
    const controller = new AbortController();
    hearingService.list(caseInfo.caseId, controller.signal)
      .then(items => { setHearings(items); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseInfo.caseId, hearingService, refresh]);

  useEffect(() => {
    const refreshCalendar = () => {
      setNow(Date.now());
      setRefresh(value => value + 1);
    };
    const interval = window.setInterval(refreshCalendar, 60000);
    window.addEventListener('focus', refreshCalendar);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshCalendar);
    };
  }, []);

  const hearingDays = useMemo(() => new Set(hearings.map(item => hearingDateKey(item.startsAt))), [hearings]);
  const selectedKey = selectedDate ? calendarDateKey(selectedDate) : null;
  const nextHearing = hearings.find(item => item.status !== 'PENDING' && new Date(item.endsAt).getTime() > now);
  const visibleHearings = hearings.filter(item => selectedKey
    ? hearingDateKey(item.startsAt) === selectedKey
    : (new Date(item.endsAt).getTime() > now) === (view === 'upcoming'));
  if (!selectedKey && view === 'past') visibleHearings.reverse();

  return (
    <section aria-labelledby="hearing-calendar-heading" className="p-4 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h3 id="hearing-calendar-heading" className="text-lg font-semibold text-gray-900">Appointment Calendar</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">Shared schedule · Philippine time (UTC+8).</p>
          {!canBook && <p className="mt-1 text-xs text-gray-500">
            Appointments can be proposed while the case is accepted.
          </p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRefresh(value => value + 1)} aria-label="Refresh appointments" className="p-2 text-gray-500 rounded-md hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canBook && (
            <button type="button" aria-haspopup="dialog" onClick={() => {
              setEditing(null);
              setShowForm(true);
            }} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Propose appointment
            </button>
          )}
        </div>
      </div>

      {canBook && showForm && <AppointmentProposalForm cases={[caseInfo]} appointment={editing}
        initialDate={selectedKey && selectedKey >= hearingDateKey() ? selectedKey : undefined}
        onClose={() => setShowForm(false)} onSuccess={() => {
          setShowForm(false); setEditing(null); setNow(Date.now()); setRefresh(value => value + 1);
        }} />}

      {error && <div role="alert" className="p-3 mt-4 text-sm text-red-700 border border-red-100 rounded-md bg-red-50">{error} Use refresh to try again.</div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="w-5 h-5 animate-spin" />Loading appointments…</div> : (
        <>
          <div className="grid gap-5 mt-4 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto md:mx-0">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} month={month} onMonthChange={setMonth}
                today={calendarDate(hearingDateKey(now))}
                modifiers={{ hearing: date => hearingDays.has(calendarDateKey(date)) }}
                modifiersClassNames={{ hearing: 'font-bold underline decoration-blue-500 decoration-2 underline-offset-4' }}
                classNames={{ day_selected: 'bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-600', day_today: 'bg-blue-50 text-blue-700 font-semibold' }} />
              <p className="text-xs text-center text-gray-500">Underlined dates have appointments.</p>
            </div>
            <div className="min-w-0">
              {nextHearing && (
                <div className="p-3 mb-3 border border-blue-100 rounded-lg bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700">{new Date(nextHearing.startsAt).getTime() <= now ? 'APPOINTMENT IN PROGRESS' : 'NEXT APPOINTMENT'}</p>
                  <p className="mt-1 font-semibold text-gray-900">{nextHearing.title}</p>
                  <p className="mt-1 text-sm text-blue-900">{formatHearingDate(nextHearing.startsAt)} · {formatHearingTime(nextHearing.startsAt)} – {formatHearingTime(nextHearing.endsAt)}</p>
                  <div className="mt-2"><AppointmentMeetingDetails appointment={nextHearing} /></div>
                </div>
              )}
              {selectedKey ? (
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">{formatHearingDate(hearingInstant(selectedKey, '12:00'))}</h4>
                  <button type="button" onClick={() => setSelectedDate(undefined)} className="text-xs font-medium text-blue-600">Show all</button>
                </div>
              ) : (
                <div className="flex gap-2 mb-3" aria-label="Appointment list filter">
                  {['upcoming', 'past'].map(tab => <button key={tab} type="button" aria-pressed={view === tab} onClick={() => setView(tab)}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${view === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {tab === 'upcoming' ? 'Upcoming appointments' : 'Past appointments'}
                  </button>)}
                </div>
              )}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {visibleHearings.length === 0 ? <p className="py-8 text-sm text-center text-gray-500">
                  {error ? 'The appointment schedule could not be loaded.' : selectedKey ? 'No appointments on this date.' : view === 'past' ? 'No past appointments yet.' : 'No upcoming appointments scheduled.'}
                </p> : visibleHearings.map(hearing => (
                  <article key={hearing.hearingId} className="p-3 border border-gray-200 rounded-md">
                    <h5 className="text-sm font-semibold text-gray-900 break-words">{hearing.title}</h5>
                    <p className="mt-1 text-xs font-medium text-blue-700">{formatHearingDate(hearing.startsAt)}</p>
                    <p className="flex items-center gap-2 mt-2 text-sm text-gray-600"><Clock3 className="w-4 h-4 shrink-0" />{formatHearingTime(hearing.startsAt)} – {formatHearingTime(hearing.endsAt)}</p>
                    <div className="mt-2"><AppointmentMeetingDetails appointment={hearing} /></div>
                    <AppointmentActions appointment={hearing} caseInfo={caseInfo} userId={authData.userId}
                      onChange={() => setRefresh(value => value + 1)}
                      onEdit={() => { setEditing({ ...hearing, legalCase: caseInfo }); setShowForm(true); }} />
                    {hearing.notes && <p className="pt-2 mt-2 text-sm text-gray-600 whitespace-pre-wrap break-words border-t border-gray-100">{hearing.notes}</p>}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
