import { questHints } from './demoHints.js';

export const DEMO_KEY = 'ally-respondent-demo-v1';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const SAMPLE_PDF = '/demo/GR-233460.pdf';
export const SAMPLE_NAME = 'G.R. No. 233460.pdf';

const questQuestions = {
  'case-search': {
    prompt: 'What did Case Search show for your query?',
    options: ['Matching court decisions or links', 'A message that no matching cases were found', 'I couldn’t tell what the results meant'],
  },
  appointment: {
    prompt: 'What status did the appointment show after your action?',
    options: ['Confirmed after I accepted the proposal', 'Waiting for the other participant after I sent or updated a proposal', 'I couldn’t tell what status it showed'],
  },
  'review-document': {
    prompt: 'What happened after you entered the practice code for the PDF?',
    options: ['The PDF opened in the preview', 'The browser started downloading the PDF', 'I couldn’t tell what happened'],
  },
};

export const quests = [
  { id: 'chat', requires: [], title: 'Try normal queries', detail: 'With Case Search OFF, ask a Philippine legal question and review the explanation. Try a follow-up, too.', path: '/demo/chat?mode=normal', action: 'Open normal queries' },
  { id: 'case-search', requires: ['chat'], title: 'Try Case Search', detail: 'With Case Search ON, search for Supreme Court decisions involving civil cases and review the results or no-match message. Open any returned official sources.', path: '/demo/chat?mode=case-search', action: 'Open Case Search' },
  { id: 'draft', requires: ['chat', 'case-search'], optional: true, title: 'Try the AI writing assistant', detail: 'Enter fictional case facts, generate a draft, and apply a suggested title or description.', path: '/demo/workspace?new=1', action: 'Open AI drafting' },
  { id: 'case', requires: ['chat', 'case-search'], title: 'Create a civil case', detail: 'Use Submit New Case in Case Workspace and choose an existing verified lawyer.', path: '/demo/workspace?new=1', revisitPath: '/demo/workspace?tab=overview', action: 'Create civil case' },
  { id: 'workspace', requires: ['case'], title: 'Explore your collaboration workspace', detail: 'Review Overview and Appointment Calendar, then add a workspace note.', path: '/demo/workspace?tab=overview', action: 'Open workspace' },
  { id: 'appointment', requires: ['case'], optional: true, title: 'Try an appointment proposal', detail: 'Accept the simulated lawyer’s proposal or send your own online or face-to-face proposal.', path: '/demo/workspace?tab=hearings', action: 'Open appointment calendar' },
  { id: 'unlock-documents', requires: ['case'], title: 'Unlock the document workspace', detail: 'Request a six-digit practice code, then enter the code shown on screen to unlock Documents.', path: '/demo/workspace?tab=documents', action: 'Unlock documents' },
  { id: 'upload', requires: ['workspace', 'unlock-documents'], title: 'Upload the sample PDF', detail: 'Download the supplied decision, select it, and click Upload All.', path: '/demo/workspace?tab=documents', action: 'Go to documents' },
  { id: 'summary', requires: ['upload'], title: 'Summarize the document', detail: 'Use the document’s Summarize button and review the AI summary.', path: '/demo/workspace?tab=documents', action: 'Summarize PDF' },
  { id: 'review-document', requires: ['upload'], title: 'Open the original PDF', detail: 'Use Preview or Download and enter its separate practice code. Compare the original with the summary.', path: '/demo/workspace?tab=documents', action: 'Open document tools' },
].map(quest => ({ ...quest, hints: questHints[quest.id], question: questQuestions[quest.id] }));

const documentQuests = ['upload', 'summary', 'review-document'];

function clearDocumentProgress(state) {
  const answers = { ...state.answers };
  delete answers['review-document'];
  return {
    document: null,
    summary: null,
    completed: state.completed.filter(id => !documentQuests.includes(id)),
    pendingQuestions: (state.pendingQuestions || []).filter(id => !documentQuests.includes(id)),
    answers,
  };
}

export function newDemoSession() {
  return { version: 2, id: crypto.randomUUID(), started: false, completed: [], messages: [],
    legalCase: null, visits: [], notes: '', document: null, summary: null, hints: {}, pendingQuestions: [], answers: {} };
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
      const savedQuestions = Array.isArray(saved.pendingQuestions) ? saved.pendingQuestions : [];
      const pendingQuestions = quests.filter(quest => quest.question && savedQuestions.includes(quest.id) && !completed.has(quest.id))
        .map(quest => quest.id);
      if (!pendingQuestions.includes('appointment') && Array.isArray(saved.caseAppointments)
        && saved.caseAppointments.some(item => item?.proposedBy === -1 || item?.acceptedBy === -1)) {
        completed.add('appointment');
      }
      return { ...saved, version: 2, busy: false, pendingQuestions, answers: saved.answers || {},
        completed: quests.filter(quest => completed.has(quest.id)).map(quest => quest.id) };
    }
  } catch { /* A fresh respondent session is safe when storage is unavailable. */ }
  return newDemoSession();
}

export function questUnlocked(state, indexOrId) {
  const index = typeof indexOrId === 'string' ? quests.findIndex(quest => quest.id === indexOrId) : indexOrId;
  if (!Number.isInteger(index) || index < 0 || index >= quests.length) return false;
  const quest = quests[index];
  return state.started && quest.requires.every(id => state.completed.includes(id));
}

export function demoReducer(state, action) {
  const pendingQuestions = state.pendingQuestions || [];
  const recordQuestAction = (id, changes = {}) => {
    const completed = changes.completed || state.completed;
    if (questQuestions[id] && !completed.includes(id)) {
      const pending = pendingQuestions.includes(id) ? pendingQuestions : [...pendingQuestions, id];
      return { ...state, ...changes, pendingQuestions: pending };
    }
    return { ...state, ...changes, completed: completed.includes(id) ? completed : [...completed, id] };
  };
  switch (action.type) {
    case 'answer-question': {
      const { questId, answer } = action;
      if (!state.started || !pendingQuestions.includes(questId) || !questQuestions[questId]?.options.includes(answer)) return state;
      return { ...state, completed: [...state.completed, questId], answers: { ...state.answers, [questId]: answer },
        pendingQuestions: pendingQuestions.filter(id => id !== questId) };
    }
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
    case 'case-appointments': return action.practiced && questUnlocked(state, 'appointment')
      ? recordQuestAction('appointment', { caseAppointments: action.items }) : { ...state, caseAppointments: action.items };
    case 'appointment': return { ...state, appointments: [...(state.appointments || []), action.appointment] };
    case 'cancel-appointment': return { ...state, appointments: (state.appointments || []).filter(item => item.scheduleId !== action.id) };
    case 'delete-document': return { ...state, ...clearDocumentProgress(state) };
    case 'messages': return { ...state, messages: action.messages };
    case 'chat-success': return !state.started ? state
      : action.mode === 'normal' ? recordQuestAction('chat')
      : action.mode === 'case-search' ? recordQuestAction('case-search') : state;
    case 'create-case': return questUnlocked(state, 'case') && !state.legalCase
      ? recordQuestAction('case', { legalCase: action.legalCase }) : state;
    case 'apply-draft': return questUnlocked(state, 'draft') ? recordQuestAction('draft') : state;
    case 'visit': {
      if (!state.legalCase) return state;
      const visits = [...new Set([...state.visits, action.tab])];
      return visits.includes('overview') && visits.includes('hearings') && state.notes.trim()
        ? recordQuestAction('workspace', { visits }) : { ...state, visits };
    }
    case 'save-notes': return !state.legalCase ? state
      : action.notes.trim() && state.visits.includes('overview') && state.visits.includes('hearings')
        ? recordQuestAction('workspace', { notes: action.notes }) : { ...state, notes: action.notes };
    case 'unlock-documents': return questUnlocked(state, 'unlock-documents') ? recordQuestAction('unlock-documents') : state;
    case 'upload': return questUnlocked(state, 'upload')
      ? recordQuestAction('upload', { ...clearDocumentProgress(state), document: action.document }) : state;
    case 'summary': return questUnlocked(state, 'summary') && state.document
      ? recordQuestAction('summary', { summary: action.summary }) : state;
    case 'review-document': return questUnlocked(state, 'review-document') && state.document
      ? recordQuestAction('review-document') : state;
    case 'reset': return newDemoSession();
    default: return state;
  }
}

