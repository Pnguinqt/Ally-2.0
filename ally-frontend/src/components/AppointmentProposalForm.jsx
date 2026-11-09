import { useState } from 'react';
import { Loader2, MapPin, Video } from 'lucide-react';
import SidePanel from './shared/SidePanel.jsx';
import { hearingService as productionService } from '../services/hearingService.js';
import { useDemoRuntime } from '../demo/DemoContext';
import { hearingDateKey, hearingInstant } from '../utils/hearingDates.js';
import { validMeetingLink } from '../utils/appointmentMeetings.js';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const timeValue = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '';

export default function AppointmentProposalForm({ cases, appointment, initialDate, onClose, onSuccess }) {
  const demo = useDemoRuntime();
  const service = demo?.hearingService || productionService;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    caseId: String(appointment?.legalCase?.caseId ?? cases[0]?.caseId ?? ''),
    title: appointment?.title || '', date: appointment ? hearingDateKey(appointment.startsAt) : initialDate || hearingDateKey(),
    start: timeValue(appointment?.startsAt), end: timeValue(appointment?.endsAt),
    location: appointment?.location || '', notes: appointment?.notes || '',
    meetingType: appointment?.meetingType || 'F2F', meetingLink: appointment?.meetingLink || '',
  });
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const startsAt = hearingInstant(form.date, form.start);
    const endsAt = hearingInstant(form.date, form.end);
    if (new Date(startsAt).getTime() <= Date.now() || endsAt <= startsAt) {
      setError('Choose a future appointment with an end time after its start.'); return;
    }
    if (form.meetingType === 'ONLINE' && !validMeetingLink(form.meetingLink.trim())) {
      setError('Enter a valid http or https meeting link.'); return;
    }
    setSaving(true);
    try {
      const data = { title: form.title.trim(), meetingType: form.meetingType,
        location: form.meetingType === 'F2F' ? form.location.trim() : '',
        meetingLink: form.meetingType === 'ONLINE' ? form.meetingLink.trim() : null,
        notes: form.notes.trim(), startsAt, endsAt, revision: appointment?.revision ?? 0 };
      if (appointment) await service.edit(form.caseId, appointment.hearingId, data);
      else await service.book(form.caseId, data);
      onSuccess();
    } catch (err) { setError(err.message || 'Unable to save this proposal.'); }
    finally { setSaving(false); }
  };

  return <SidePanel title={appointment ? 'Edit appointment proposal' : 'Propose an appointment'}
    description="The other participant must accept your proposal. Changes to a confirmed appointment require acceptance again. All times are Philippine time (UTC+8)."
    busy={saving} onClose={onClose}>
    <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
      <fieldset disabled={saving} className="grid flex-1 min-h-0 gap-4 p-5 overflow-y-auto sm:grid-cols-2">
        <label className="text-sm text-gray-700 sm:col-span-2">Case
          <select required disabled={Boolean(appointment)} name="caseId" value={form.caseId} onChange={change} className={inputClass}>
            {cases.map(item => <option key={item.caseId} value={String(item.caseId)}>#{item.caseId} · {item.title}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 sm:col-span-2">Appointment title
          <input autoFocus required maxLength={160} name="title" value={form.title} onChange={change} className={inputClass} placeholder="e.g. Case consultation" />
        </label>
        <label className="text-sm text-gray-700 sm:col-span-2">Date
          <input required type="date" name="date" min={hearingDateKey()} value={form.date} onChange={change} className={inputClass} />
        </label>
        <label className="text-sm text-gray-700">Start time<input required type="time" name="start" value={form.start} onChange={change} className={inputClass} /></label>
        <label className="text-sm text-gray-700">End time<input required type="time" name="end" value={form.end} onChange={change} className={inputClass} /></label>
        <div className="sm:col-span-2">
          <p id="meeting-type-label" className="mb-2 text-sm font-medium text-gray-700">Meeting type</p>
          <div role="group" aria-labelledby="meeting-type-label" className="grid grid-cols-2 gap-2">
            {[['F2F', 'Face-to-face', MapPin], ['ONLINE', 'Online', Video]].map(([value, label, icon]) => {
              const Icon = icon;
              return (
              <button key={value} type="button" aria-pressed={form.meetingType === value}
                onClick={() => setForm(current => ({ ...current, meetingType: value }))}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium ${form.meetingType === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
              );
            })}
          </div>
          <div className="p-4 mt-3 border border-gray-200 rounded-lg bg-gray-50">
            {form.meetingType === 'F2F' ? <label className="text-sm text-gray-700">Venue / address
              <input required maxLength={255} name="location" value={form.location} onChange={change} className={`${inputClass} bg-white`} placeholder="Office, court, building, and full address" />
              <span className="block mt-2 text-xs text-gray-500">Enter where both participants will meet in person.</span>
            </label> : <label className="text-sm text-gray-700">Online meeting link
              <input required type="url" maxLength={2048} name="meetingLink" value={form.meetingLink} onChange={change} className={`${inputClass} bg-white`} placeholder="https://meet.google.com/…" />
              <span className="block mt-2 text-xs text-gray-500">Paste your Zoom, Google Meet, Teams, or other meeting link.</span>
            </label>}
          </div>
        </div>
        <label className="text-sm text-gray-700 sm:col-span-2">Notes (optional)
          <textarea maxLength={4000} rows={3} name="notes" value={form.notes} onChange={change} className={inputClass} />
        </label>
      </fieldset>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
        <button type="button" disabled={saving} onClick={onClose} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
        <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Saving…' : 'Send proposal'}
        </button>
      </div>
    </form>
  </SidePanel>;
}
