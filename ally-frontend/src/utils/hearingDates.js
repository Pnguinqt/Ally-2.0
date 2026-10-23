const TIME_ZONE = 'Asia/Manila';

export function hearingDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// DayPicker uses local calendar dates. Build its date from Manila's date parts.
export function calendarDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hearingInstant(date, time) {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

export function formatHearingDate(value) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value));
}

export function formatHearingTime(value) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}
