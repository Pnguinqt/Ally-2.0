export const HEARING_LOAD_TIMEOUT_MS = 30_000;

function isValidDate(value) {
  return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(new Date(value).getTime());
}

export function readHearingSchedule(response) {
  if (!Array.isArray(response)) {
    throw new Error('The appointment schedule came back in an unexpected format.');
  }

  const appointments = response.filter(item =>
    item && isValidDate(item.startsAt) && isValidDate(item.endsAt)
    && [item.title, item.location, item.notes].every(value => value == null || typeof value === 'string'));
  return { appointments, incomplete: appointments.length !== response.length };
}
