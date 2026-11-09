import { getAuthData } from '../utils/auth.jsx';
import { demoRequest } from '../demo/demoService.js';

export async function suggestCaseDraft({ title, description, facts, caseType }, { demo = false, signal } = {}) {
  const auth = demo ? null : getAuthData();
  if (!demo && !auth) throw new Error('Please sign in to use the case writing assistant.');
  const request = {
    method: 'POST', signal, credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ title, description, facts, caseType, language: localStorage.getItem('ally-language') || 'en' }),
  };
  let result;
  if (demo) {
    result = await demoRequest('/case-draft', request);
  } else {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cases/draft-assist`, request);
    result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'ALLY could not prepare a draft. Please try again.');
  }
  if (typeof result.title !== 'string' || typeof result.description !== 'string'
      || result.title.trim().length < 5 || result.title.length > 160
      || result.description.trim().length < 20 || result.description.length > 1000) {
    throw new Error('ALLY returned an incomplete draft. Try again or continue writing your case details.');
  }
  return { title: result.title.trim(), description: result.description.trim() };
}
