import { getAuthData } from '../utils/auth.jsx';

async function request(caseId, options = {}, suffix = '') {
  const auth = getAuthData();
  if (!auth) throw new Error('Please sign in to access appointments');

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cases/${caseId}/hearings${suffix}`, {
    ...options,
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Unable to access appointments. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}

export const hearingService = {
  list: (caseId, signal) => request(caseId, { signal }),
  book: (caseId, hearing) => request(caseId, { method: 'POST', body: JSON.stringify(hearing) }),
  edit: (caseId, id, hearing) => request(caseId, { method: 'PUT', body: JSON.stringify(hearing) }, `/${id}`),
  accept: (caseId, id, revision) => request(caseId, { method: 'POST' }, `/${id}/accept?revision=${revision}`),
  delete: (caseId, id, revision) => request(caseId, { method: 'DELETE' }, `/${id}?revision=${revision}`),
};
