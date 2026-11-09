import { MapPin, Video } from 'lucide-react';
import { validMeetingLink } from '../utils/appointmentMeetings.js';

export default function AppointmentMeetingDetails({ appointment }) {
  const online = appointment.meetingType === 'ONLINE';
  const Icon = online ? Video : MapPin;
  return <div className="min-w-0 text-sm">
    <p className="flex items-center gap-2 font-medium text-gray-700"><Icon className="w-4 h-4 shrink-0" />{online ? 'Online meeting' : 'Face-to-face meeting'}</p>
    {online ? validMeetingLink(appointment.meetingLink) ? (
      <a href={appointment.meetingLink} target="_blank" rel="noopener noreferrer"
        className="inline-block mt-1 text-blue-600 underline break-all hover:text-blue-800">
        {appointment.status === 'PENDING' ? 'View meeting link' : 'Join online meeting'}
      </a>
    ) : <p className="mt-1 text-gray-500">Meeting link to be confirmed.</p>
      : <p className="mt-1 text-gray-500 whitespace-pre-wrap break-words">{appointment.location || 'Venue to be confirmed.'}</p>}
  </div>;
}
