import { questHints } from './demoHints.js';

export const DEMO_KEY = 'ally-respondent-demo-v1';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const SAMPLE_PDF = '/demo/GR-233460.pdf';
export const SAMPLE_NAME = 'G.R. No. 233460.pdf';

export const quests = [
  { id: 'chat', title: 'Try normal queries', detail: 'With Case Search OFF, ask a Philippine legal question and review the explanation. Try a follow-up, too.', path: '/demo/chat?mode=normal', action: 'Open normal queries' },
  { id: 'case-search', title: 'Try Case Search', detail: 'With Case Search ON, search for Supreme Court decisions involving civil cases and review the results or no-match message. Open any returned official sources.', path: '/demo/chat?mode=case-search', action: 'Open Case Search' },
  { id: 'case', title: 'Create a civil case', detail: 'Use Submit New Case in My Cases and choose an existing lawyer.', path: '/demo/my-cases?new=1', action: 'Create civil case' },
  { id: 'workspace', title: 'Explore your collaboration workspace', detail: 'Review Overview and Hearings, then add a workspace note.', path: '/demo/workspace?tab=overview', action: 'Open workspace' },
  { id: 'upload', title: 'Upload the sample PDF', detail: 'Download the supplied decision, select it, and click Upload All.', path: '/demo/workspace?tab=documents', action: 'Go to documents' },
  { id: 'summary', title: 'Summarize the document', detail: 'Use the document’s Summarize button and compare the output with the PDF.', path: '/demo/workspace?tab=documents', action: 'Summarize PDF' },
].map(quest => ({ ...quest, hints: questHints[quest.id] }));

export function newDemoSession() {
  return { version: 2, id: crypto.randomUUID(), started: false, completed: [], messages: [],
    legalCase: null, visits: [], notes: '', document: null, summary: null, hints: {} };
}

export function readDemoSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY));
    if ([1, 2].includes(saved?.version) && typeof saved.id === 'string' && Array.isArray(saved.completed)
      && Array.isArray(saved.messages) && Array.isArray(saved.visits)) {
      const completed = new Set(saved.completed);
      if (saved.version === 1) {
        // The previous combined quest did not distinguish the two modes. Keep credit
        // only for modes that have successful replies in the respondent's saved chats.
        completed.delete('chat');
        const messages = [...saved.messages, ...Object.values(saved.conversations || {}).flatMap(chat => chat.messages || [])];
        for (const message of messages) {
          if (message.sender !== 'ai' || message.isError || !message.text?.trim()) continue;
          if (message.ragEnabled === false) completed.add('chat');
          if (message.ragEnabled === true && Array.isArray(message.relevantCases)) completed.add('case-search');
        }
      }
      return { ...saved, version: 2, busy: false, completed: quests.filter(quest => completed.has(quest.id)).map(quest => quest.id) };
    }
  } catch { /* A fresh respondent session is safe when storage is unavailable. */ }
  return newDemoSession();
}

export function questUnlocked(state, indexOrId) {
  const index = typeof indexOrId === 'string' ? quests.findIndex(quest => quest.id === indexOrId) : indexOrId;
  if (!Number.isInteger(index) || index < 0 || index >= quests.length) return false;
  return state.started && quests.slice(0, index).every(quest => state.completed.includes(quest.id));
}

export function demoReducer(state, action) {
  const complete = (id, changes = {}) => {
    const completed = changes.completed || state.completed;
    return { ...state, ...changes, completed: completed.includes(id) ? completed : [...completed, id] };
  };
  switch (action.type) {
    case 'reveal-hint': {
      const quest = quests.find(item => item.id === action.questId);
      if (!state.started || !quest) return state;
      const savedCount = state.hints?.[quest.id];
      const count = Number.isInteger(savedCount) && savedCount > 0 ? savedCount : 0;
      return { ...state, hints: { ...state.hints, [quest.id]: Math.min(count + 1, quest.hints.length) } };
    }
    case 'start': return { ...state, started: true, startedAt: new Date().toISOString() };
    case 'busy': return { ...state, busy: action.busy };
    case 'profile': return { ...state, profile: action.profile };
    case 'contact-messages': return { ...state, contactMessages: action.messages };
    case 'save-chat': return { ...state, messages: action.chat.messages, chatId: action.chat.conversationId, useRAG: action.chat.useRAG,
      conversations: { ...(state.conversations || {}), [action.chat.conversationId]: { messages: action.chat.messages, updatedAt: new Date().toISOString() } } };
    case 'archive-chat': return { ...state, conversations: { ...(state.conversations || {}), [action.id]: { messages: action.messages, updatedAt: new Date().toISOString() } } };
    case 'remove-chat-turn': {
      const remove = messages => {
        const index = messages.findIndex(item => item.sender === 'ai' && (item.id === action.id || item.requestId === action.id));
        return index < 0 ? messages : messages.filter((_, i) => i !== index && i !== index - 1);
      };
      return { ...state, messages: remove(state.messages), conversations: Object.fromEntries(Object.entries(state.conversations || {})
        .map(([id, chat]) => [id, { ...chat, messages: remove(chat.messages) }])) };
    }
    case 'update-case': return { ...state, legalCase: action.legalCase };
    case 'appointment': return { ...state, appointments: [...(state.appointments || []), action.appointment] };
    case 'cancel-appointment': return { ...state, appointments: (state.appointments || []).filter(item => item.scheduleId !== action.id) };
    case 'delete-document': return { ...state, document: null, summary: null, completed: state.completed.filter(id => !['upload', 'summary'].includes(id)) };
    case 'messages': return { ...state, messages: action.messages };
    case 'chat-success': return !state.started ? state
      : action.mode === 'normal' ? complete('chat')
      : action.mode === 'case-search' ? complete('case-search') : state;
    case 'create-case': return questUnlocked(state, 'case') && !state.legalCase
      ? complete('case', { legalCase: action.legalCase }) : state;
    case 'visit': {
      if (!state.legalCase) return state;
      const visits = [...new Set([...state.visits, action.tab])];
      return visits.includes('overview') && visits.includes('hearings') && state.notes.trim()
        ? complete('workspace', { visits }) : { ...state, visits };
    }
    case 'save-notes': return !state.legalCase ? state
      : action.notes.trim() && state.visits.includes('overview') && state.visits.includes('hearings')
        ? complete('workspace', { notes: action.notes }) : { ...state, notes: action.notes };
    case 'upload': return questUnlocked(state, 'upload')
      ? complete('upload', { document: action.document, summary: null,
        completed: state.completed.filter(id => id !== 'summary') }) : state;
    case 'summary': return questUnlocked(state, 'summary') && state.document
      ? complete('summary', { summary: action.summary }) : state;
    case 'reset': return newDemoSession();
    default: return state;
  }
}

