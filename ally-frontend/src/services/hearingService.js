import { getAuthData } from '../utils/auth.jsx';

async function request(caseId, options = {}) {
  const auth = getAuthData();
  if (!auth) throw new Error('Please sign in to access hearings');

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cases/${caseId}/hearings`, {
    ...options,
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Unable to access hearings. Please try again.');
  }
  return response.json();
}

export const hearingService = {
  list: (caseId, signal) => request(caseId, { signal }),
  book: (caseId, hearing) => request(caseId, { method: 'POST', body: JSON.stringify(hearing) }),
};
