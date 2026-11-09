async function request(caseId, token, options, fallback) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cases/${caseId}/note`, {
    ...options,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }).catch(() => { throw new Error(fallback); });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || fallback);
  }
  const note = await response.json().catch(() => null);
  if (note?.content !== null && typeof note?.content !== 'string') throw new Error(fallback);
  return note.content;
}

export const caseNoteService = {
  load: (caseId, token, signal) => request(caseId, token, { signal }, 'Could not load your note. Try again.'),
  save: (caseId, token, content) => request(caseId, token, {
    method: 'PUT', body: JSON.stringify({ content }),
  }, 'Could not save your note. Try again.'),
};
