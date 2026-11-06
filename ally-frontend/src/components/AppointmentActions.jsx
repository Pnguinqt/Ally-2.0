import { useState } from 'react';
import { toast } from 'sonner';
import { hearingService as productionService } from '../services/hearingService.js';
import { useDemoRuntime } from '../demo/DemoContext';

export default function AppointmentActions({ appointment, caseInfo, userId, onEdit, onChange }) {
  const demo = useDemoRuntime();
  const service = demo?.hearingService || productionService;
  const [busy, setBusy] = useState(false);
  const pending = appointment.status === 'PENDING';
  const mine = Number(appointment.proposedBy) === Number(userId);
  const editable = caseInfo.status === 'ACCEPTED' && new Date(appointment.startsAt).getTime() > Date.now();
  const expired = pending && new Date(appointment.startsAt).getTime() <= Date.now();
  const perform = async action => {
    if (busy) return;
    if (action === 'delete' && !window.confirm('Delete this appointment for both you and the other participant?')) return;
    setBusy(true);
    try {
      await service[action](caseInfo.caseId, appointment.hearingId, appointment.revision ?? 0);
      toast.success(action === 'accept' ? 'Appointment confirmed.' : 'Appointment deleted.');
      onChange();
    } catch (err) { toast.error(err.message || 'Unable to update this appointment.'); onChange(); }
    finally { setBusy(false); }
  };
  return <div className="mt-3">
    <p className={`text-xs font-medium ${pending ? 'text-amber-700' : 'text-green-700'}`}>
      {expired ? 'Proposal expired without acceptance' : pending ? mine ? 'Your proposal · Waiting for the other participant' : 'New proposal · Waiting for your acceptance' : 'Confirmed'}
    </p>
    <div className="flex flex-wrap gap-2 mt-2">
      {pending && !mine && editable && <button type="button" disabled={busy} onClick={() => perform('accept')} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50">Accept proposal</button>}
      {editable && <button type="button" disabled={busy} onClick={onEdit} className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg disabled:opacity-50">Edit proposal</button>}
      <button type="button" disabled={busy} onClick={() => perform('delete')} className="px-3 py-1.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">Delete</button>
    </div>
  </div>;
}
