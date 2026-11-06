import { getAuthData } from '../utils/auth.jsx';

export async function suggestCaseDraft(data, { demo = false, signal } = {}) {
  const auth = demo ? null : getAuthData();
  if (!demo && !auth) throw new Error('Please sign in to use the case writing assistant.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${demo ? '/api/demo/case-draft' : '/api/cases/draft-assist'}`, {
    method: 'POST', signal, credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ ...data, language: localStorage.getItem('ally-language') || 'en' }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'ALLY could not prepare a draft. Please try again.');
  if (typeof result.title !== 'string' || typeof result.description !== 'string'
      || result.title.trim().length < 5 || result.title.length > 160
      || result.description.trim().length < 20 || result.description.length > 1000) {
    throw new Error('ALLY returned an incomplete draft. Try again or continue writing your case details.');
  }
  return { title: result.title.trim(), description: result.description.trim() };
}
