import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Loader2, MapPin, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from './ui/calendar.jsx';
import SidePanel from './shared/SidePanel.jsx';
import { hearingService } from '../services/hearingService.js';
import { calendarDate, calendarDateKey, formatHearingDate, formatHearingTime, hearingDateKey, hearingInstant } from '../utils/hearingDates.js';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function CaseHearingCalendar({ caseInfo, authData }) {
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [month, setMonth] = useState(() => calendarDate(hearingDateKey()));
  const [selectedDate, setSelectedDate] = useState();
  const [view, setView] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title: '', date: hearingDateKey(), start: '', end: '', location: '', notes: '' });
  const canBook = authData.accountType === 'LAWYER'
    && Number(caseInfo.lawyer?.userId) === Number(authData.userId)
    && caseInfo.status === 'ACCEPTED';

  useEffect(() => {
    const controller = new AbortController();
    hearingService.list(caseInfo.caseId, controller.signal)
      .then(items => { setHearings(items); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseInfo.caseId, refresh]);

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
  const nextHearing = hearings.find(item => new Date(item.endsAt).getTime() > now);
  const visibleHearings = hearings.filter(item => selectedKey
    ? hearingDateKey(item.startsAt) === selectedKey
    : (new Date(item.endsAt).getTime() > now) === (view === 'upcoming'));
  if (!selectedKey && view === 'past') visibleHearings.reverse();

  const changeField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const bookHearing = async event => {
    event.preventDefault();
    if (!canBook || saving) return;
    setFormError('');
    const startsAt = hearingInstant(form.date, form.start);
    const endsAt = hearingInstant(form.date, form.end);
    if (new Date(startsAt).getTime() <= Date.now() || endsAt <= startsAt) {
      setFormError('Choose a future hearing time with an end time after its start.');
      return;
    }
    setSaving(true);
    try {
      const hearing = await hearingService.book(caseInfo.caseId, {
        title: form.title.trim(), startsAt, endsAt, location: form.location.trim(), notes: form.notes.trim(),
      });
      setHearings(current => [...current, hearing].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setNow(Date.now());
      setSelectedDate(calendarDate(form.date));
      setMonth(calendarDate(form.date));
      setShowForm(false);
      setForm({ title: '', date: hearingDateKey(), start: '', end: '', location: '', notes: '' });
      setRefresh(value => value + 1);
      toast.success('Hearing booked and shared with your client');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="hearing-calendar-heading" className="p-4 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h3 id="hearing-calendar-heading" className="text-lg font-semibold text-gray-900">Hearing Calendar</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">Shared schedule · Philippine time (UTC+8).</p>
          {!canBook && <p className="mt-1 text-xs text-gray-500">
            {authData.accountType === 'LAWYER' ? 'Booking opens for the assigned lawyer while the case is accepted.' : 'Your lawyer manages hearing bookings.'}
          </p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRefresh(value => value + 1)} aria-label="Refresh hearings" className="p-2 text-gray-500 rounded-md hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canBook && (
            <button type="button" aria-haspopup="dialog" onClick={() => {
              setShowForm(true);
              setFormError('');
              if (selectedKey && selectedKey >= hearingDateKey()) setForm(current => ({ ...current, date: selectedKey }));
            }} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Book hearing
            </button>
          )}
        </div>
      </div>

      {canBook && showForm && (
        <SidePanel title="Book the next hearing" description="Share the hearing details with your client. All times are Philippine time (UTC+8)."
          busy={saving} onClose={() => setShowForm(false)}>
          <form id="hearing-booking-form" onSubmit={bookHearing} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain">
              <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-gray-700 sm:col-span-2">Hearing title
                  <input autoFocus required name="title" value={form.title} onChange={changeField} maxLength={160} placeholder="e.g. Pre-trial hearing" className={inputClass} />
                </label>
                <label className="text-sm text-gray-700 sm:col-span-2">Date
                  <input required type="date" name="date" min={hearingDateKey()} value={form.date} onChange={changeField} className={inputClass} />
                </label>
                <label className="text-sm text-gray-700">Start time
                  <input required type="time" name="start" value={form.start} onChange={changeField} className={inputClass} />
                </label>
                <label className="text-sm text-gray-700">End time
                  <input required type="time" name="end" value={form.end} onChange={changeField} className={inputClass} />
                </label>
                <label className="text-sm text-gray-700 sm:col-span-2">Court / location
                  <input required name="location" value={form.location} onChange={changeField} maxLength={255} placeholder="Court, branch, or online meeting details" className={inputClass} />
                </label>
                <label className="text-sm text-gray-700 sm:col-span-2">Notes (optional)
                  <textarea name="notes" value={form.notes} onChange={changeField} maxLength={4000} rows={3} placeholder="What should your client prepare?" className={inputClass} />
                </label>
              </fieldset>
              {formError && <p role="alert" className="mt-3 text-sm text-red-700">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 shrink-0">
              <button type="button" disabled={saving} onClick={() => setShowForm(false)} className="text-sm text-gray-600 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Booking…' : 'Book hearing'}
              </button>
            </div>
          </form>
        </SidePanel>
      )}

      {error && <div role="alert" className="p-3 mt-4 text-sm text-red-700 border border-red-100 rounded-md bg-red-50">{error} Use refresh to try again.</div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="w-5 h-5 animate-spin" />Loading hearings…</div> : (
        <>
          <div className="grid gap-5 mt-4 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto md:mx-0">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} month={month} onMonthChange={setMonth}
                today={calendarDate(hearingDateKey(now))}
                modifiers={{ hearing: date => hearingDays.has(calendarDateKey(date)) }}
                modifiersClassNames={{ hearing: 'font-bold underline decoration-blue-500 decoration-2 underline-offset-4' }}
                classNames={{ day_selected: 'bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-600', day_today: 'bg-blue-50 text-blue-700 font-semibold' }} />
              <p className="text-xs text-center text-gray-500">Underlined dates have hearings.</p>
            </div>
            <div className="min-w-0">
              {nextHearing && (
                <div className="p-3 mb-3 border border-blue-100 rounded-lg bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700">{new Date(nextHearing.startsAt).getTime() <= now ? 'HEARING IN PROGRESS' : 'NEXT HEARING'}</p>
                  <p className="mt-1 font-semibold text-gray-900">{nextHearing.title}</p>
                  <p className="mt-1 text-sm text-blue-900">{formatHearingDate(nextHearing.startsAt)} · {formatHearingTime(nextHearing.startsAt)} – {formatHearingTime(nextHearing.endsAt)}</p>
                  <p className="mt-1 text-sm text-gray-600 break-words">{nextHearing.location}</p>
                </div>
              )}
              {selectedKey ? (
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">{formatHearingDate(hearingInstant(selectedKey, '12:00'))}</h4>
                  <button type="button" onClick={() => setSelectedDate(undefined)} className="text-xs font-medium text-blue-600">Show all</button>
                </div>
              ) : (
                <div className="flex gap-2 mb-3" aria-label="Hearing list filter">
                  {['upcoming', 'past'].map(tab => <button key={tab} type="button" aria-pressed={view === tab} onClick={() => setView(tab)}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${view === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {tab === 'upcoming' ? 'Upcoming hearings' : 'Past hearings'}
                  </button>)}
                </div>
              )}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {visibleHearings.length === 0 ? <p className="py-8 text-sm text-center text-gray-500">
                  {error ? 'The hearing schedule could not be loaded.' : selectedKey ? 'No hearings on this date.' : view === 'past' ? 'No past hearings yet.' : 'No upcoming hearings scheduled.'}
                </p> : visibleHearings.map(hearing => (
                  <article key={hearing.hearingId} className="p-3 border border-gray-200 rounded-md">
                    <h5 className="text-sm font-semibold text-gray-900 break-words">{hearing.title}</h5>
                    <p className="mt-1 text-xs font-medium text-blue-700">{formatHearingDate(hearing.startsAt)}</p>
                    <p className="flex items-center gap-2 mt-2 text-sm text-gray-600"><Clock3 className="w-4 h-4 shrink-0" />{formatHearingTime(hearing.startsAt)} – {formatHearingTime(hearing.endsAt)}</p>
                    <p className="flex items-start gap-2 mt-1 text-sm text-gray-600"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span className="min-w-0 break-words">{hearing.location}</span></p>
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
