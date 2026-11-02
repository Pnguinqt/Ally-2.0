import { getAuthData } from '../utils/auth.jsx';

export async function fetchSuggestedLawyers({ signal } = {}) {
  const auth = getAuthData();
  if (!auth?.token) throw new Error('Sign in to see suggested lawyers.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lawyers/verified`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    signal,
  });
  if (!response.ok) throw new Error('Unable to load suggested lawyers. Please try again.');
  const lawyers = await response.json();
  if (!Array.isArray(lawyers)) throw new Error('Unable to load suggested lawyers. Please try again.');
  return lawyers;
}

export function lawyerMessagingContacts(lawyers, currentUserId) {
  const contacts = new Map();
  for (const lawyer of lawyers) {
    const id = lawyer.userId ?? lawyer.id;
    if (id == null || String(id) === String(currentUserId)) continue;
    const name = lawyer.fullName || `${lawyer.Fname || lawyer.fname || lawyer.firstName || ''} ${lawyer.Lname || lawyer.lname || lawyer.lastName || ''}`.trim();
    contacts.set(String(id), { id: String(id), name: name || 'Lawyer', accountType: 'LAWYER', role: 'LAWYER',
      profilePhotoUrl: lawyer.profilePhotoUrl || null });
  }
  return [...contacts.values()].sort((a, b) => a.name.localeCompare(b.name));
}
