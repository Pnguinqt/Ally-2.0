import { demoRequest, getDemoFile, saveDemoFile, deleteDemoFile } from './demoService';
import { MAX_PDF_BYTES, questUnlocked } from './demoState';
import { documentService as realDocuments } from '../services/documentService';
import { validMeetingLink } from '../utils/appointmentMeetings.js';

export const demoPath = path => path.startsWith('/demo') ? path : path === '/' || path === '/consult' ? '/demo/chat' : `/demo${path}`;
export const demoProfile = { id: -1, userId: -1, Fname: 'Respondent', Lname: 'Demo Client', firstName: 'Respondent',
  lastName: 'Demo Client', fullName: 'Respondent Demo Client', email: 'respondent@demo.local', accountType: 'CLIENT', city: 'Cebu City' };

export function normalizeDemoLawyer(profile, index) {
  const name = profile.name.replace(/^Atty\.\s*/i, '').trim();
  const [Fname, ...rest] = name.split(' ');
  return { userId: -(index + 10), demoId: profile.id, Fname, Lname: rest.join(' '), city: profile.city,
    specialization: profile.specializations || [], credentialsVerified: true };
}

export function demoCase(state) {
  if (!state.legalCase) return null;
  const item = state.legalCase;
  // Restore respondents who used the first demo implementation.
  const lawyer = item.lawyer?.userId ? item.lawyer : normalizeDemoLawyer(item.lawyer, 0);
  return { ...item, caseId: -1, caseType: 'CIVIL', client: demoProfile, lawyer,
    dateSubmitted: item.dateSubmitted || item.createdAt, updatedAt: item.updatedAt || item.createdAt,
    acceptedAt: item.dateSubmitted || item.createdAt };
}

export function demoDocument(state) {
  if (!state.document) return null;
  return { ...state.document, documentId: state.document.documentId || -1, documentName: state.document.name,
    documentType: 'pdf', uploaderRole: 'CLIENT', fileSize: state.document.size };
}

export function createDemoRuntime(getState, dispatch) {
  let cachedLawyers;
  let inFlight = 0;
  const busy = async operation => {
    inFlight++; dispatch({ type: 'busy', busy: true });
    try { return await operation(); }
    finally { inFlight--; dispatch({ type: 'busy', busy: inFlight > 0 }); }
  };
  const requireCase = () => {
    const item = demoCase(getState());
    if (!item) throw new Error('Create your practice civil case first.');
    return item;
  };
  const loadLawyers = async () => {
    if (!cachedLawyers) cachedLawyers = demoRequest('/lawyers').then(items => items.map(normalizeDemoLawyer));
    try { return await cachedLawyers; }
    catch (error) { cachedLawyers = null; throw error; }
  };
  const documentService = {
    getFileType: realDocuments.getFileType, formatFileSize: realDocuments.formatFileSize, formatDate: realDocuments.formatDate,
    validateFileType: name => /\.pdf$/i.test(name), validateFileSize: size => size > 0 && size <= MAX_PDF_BYTES,
    getCaseDocuments: async () => getState().document ? [demoDocument(getState())] : [],
    getDocumentCount: async () => getState().document ? 1 : 0,
    uploadDocument: async (_user, _case, file) => busy(async () => {
      requireCase();
      const state = getState();
      if (!questUnlocked(state, 'upload')) throw new Error('Complete both chatbot quests, review Overview and Appointment Calendar, and add a workspace note before the PDF quest.');
      if (!/\.pdf$/i.test(file.name) || !documentService.validateFileSize(file.size)) throw new Error('Choose a PDF up to 10 MB.');
      if (await file.slice(0, 5).text() !== '%PDF-') throw new Error('Choose a valid PDF file.');
      await saveDemoFile(state.id, file);
      const document = { name: file.name, size: file.size, documentId: -Date.now(), uploadedAt: new Date().toISOString() };
      dispatch({ type: 'upload', document });
      return demoDocument({ document });
    }),
    summarizeDocument: async () => busy(async () => {
      const state = getState();
      if (!questUnlocked(state, 'summary')) throw new Error('Upload the sample PDF before summarizing it.');
      const file = await getDemoFile(state.id);
      if (!file) throw new Error('Upload your PDF again; this browser no longer has its local copy.');
      const form = new FormData(); form.append('file', file, file.name);
      const summary = await demoRequest('/summary', { method: 'POST', body: form });
      if (!summary.summary?.trim()) throw new Error('The AI returned an empty summary. Try again.');
      dispatch({ type: 'summary', summary });
      return summary;
    }),
    deleteDocument: async () => {
      await deleteDemoFile(getState().id);
      dispatch({ type: 'delete-document' }); return true;
    },
    getDocumentFile: async () => {
      const file = await getDemoFile(getState().id);
      if (!file) throw new Error('Upload your PDF again; its local copy is unavailable.');
      return file;
    },
    downloadDocument: async (_id, name) => {
      const file = await documentService.getDocumentFile();
      const url = URL.createObjectURL(file); const link = document.createElement('a');
      link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
    },
  };
  const caseService = {
    getClientCases: async () => getState().legalCase ? [demoCase(getState())] : [],
    createCase: async (_client, data) => {
      if (!questUnlocked(getState(), 'case')) throw new Error('Complete a normal query with Case Search OFF and a case search with Case Search ON before creating your civil case.');
      if (getState().legalCase) throw new Error('Your practice case already exists. You can edit it or reset the demo.');
      if (data.caseType !== 'CIVIL') throw new Error('Use Civil for this evaluation.');
      const lawyer = (await loadLawyers()).find(item => item.userId === data.lawyerId);
      if (!lawyer) throw new Error('Choose an existing verified lawyer.');
      const legalCase = { ...data, caseId: -1, id: 'DEMO-CIVIL-001', status: 'ACCEPTED', client: demoProfile,
        lawyer, createdAt: new Date().toISOString(), dateSubmitted: new Date().toISOString() };
      dispatch({ type: 'create-case', legalCase }); return legalCase;
    },
    updateCase: async (_id, changes) => {
      const legalCase = { ...requireCase(), ...changes, caseType: 'CIVIL', updatedAt: new Date().toISOString() };
      dispatch({ type: 'update-case', legalCase }); return legalCase;
    },
  };
  const listCaseAppointments = () => {
    const item = requireCase();
    if (Array.isArray(getState().caseAppointments)) return getState().caseAppointments;
    const start = new Date(item.createdAt || item.dateSubmitted);
    start.setDate(start.getDate() + 7); start.setHours(9, 0, 0, 0);
    return [{ hearingId: -1, caseId: item.caseId, title: 'Example case conference (simulated)',
      startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(),
      location: 'Demo court / location', notes: 'Bring the agreement and payment records. Example only; no appointment is actually booked.',
      meetingType: 'F2F', meetingLink: null, status: 'PENDING', proposedBy: item.lawyer.userId, bookedBy: item.lawyer.userId, revision: 1 }];
  };
  const saveCaseAppointments = items => dispatch({ type: 'case-appointments', items });
  const findCaseAppointment = (id, revision) => {
    const item = listCaseAppointments().find(item => item.hearingId === id);
    if (!item) throw new Error('Appointment not found.');
    if (item.revision !== revision) throw new Error('This appointment has changed. Refresh and try again.');
    return item;
  };
  const validateProposal = (data, id) => {
    requireCase();
    if (!data.title.trim() || new Date(data.startsAt).getTime() <= Date.now() || data.endsAt <= data.startsAt) {
      throw new Error('Enter a title and valid future appointment time.');
    }
    if (data.meetingType && !['F2F', 'ONLINE'].includes(data.meetingType)) throw new Error('Choose Face-to-face or Online.');
    if (data.meetingType === 'ONLINE' ? !validMeetingLink(data.meetingLink) : !data.location?.trim()) {
      throw new Error(data.meetingType === 'ONLINE' ? 'Enter a valid http or https meeting link.' : 'Enter the meeting venue / address.');
    }
    if (listCaseAppointments().some(item => item.hearingId !== id && item.startsAt < data.endsAt && item.endsAt > data.startsAt)) {
      throw new Error('This case already has an appointment at that time.');
    }
  };
  const hearingService = {
    list: async () => listCaseAppointments(),
    book: async (_caseId, data) => {
      validateProposal(data);
      const item = { ...data, caseId: -1, hearingId: -Date.now(), status: 'PENDING', proposedBy: -1, bookedBy: -1, revision: 1 };
      saveCaseAppointments([...listCaseAppointments(), item]); return item;
    },
    edit: async (_caseId, id, data) => {
      const original = findCaseAppointment(id, data.revision); validateProposal(data, id);
      if (new Date(original.startsAt).getTime() <= Date.now()) throw new Error('An appointment that has started cannot be edited.');
      const item = { ...original, ...data, proposedBy: -1, status: 'PENDING', acceptedBy: null, revision: original.revision + 1 };
      saveCaseAppointments(listCaseAppointments().map(value => value.hearingId === id ? item : value)); return item;
    },
    accept: async (_caseId, id, revision) => {
      const original = findCaseAppointment(id, revision);
      if (original.proposedBy === -1 || original.status !== 'PENDING') throw new Error('Only the other participant can accept a pending proposal.');
      if (new Date(original.startsAt).getTime() <= Date.now()) throw new Error('This appointment has already started.');
      const item = { ...original, status: 'CONFIRMED', acceptedBy: -1, revision: revision + 1 };
      saveCaseAppointments(listCaseAppointments().map(value => value.hearingId === id ? item : value)); return item;
    },
    delete: async (_caseId, id, revision) => {
      findCaseAppointment(id, revision);
      saveCaseAppointments(listCaseAppointments().filter(item => item.hearingId !== id));
    },
  };
  const chatService = {
    sendConsultationMessage: (message, useRAG, conversationId, requestId, messages = []) => busy(async () => {
      const data = await demoRequest('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, useRAG, conversationId, requestId, language: localStorage.getItem('ally-language') || 'en',
          previousMessages: messages.slice(-40).map(item => ({ role: item.sender === 'user' ? 'user' : 'assistant', content: item.text })) }) });
      if (!data.response || /API key is not configured|couldn't complete your answer|answer is not yet complete/i.test(data.response)) throw new Error('The AI could not finish. Please try again.');
      if (useRAG === false && data.ragEnabled === false) dispatch({ type: 'chat-success', mode: 'normal' });
      // The retrieval path returns an array even when it finds no matching cases.
      // Greetings and ordinary replies do not count as a completed case search.
      if (useRAG === true && data.ragEnabled === true && Array.isArray(data.relevantCases)) {
        dispatch({ type: 'chat-success', mode: 'case-search' });
      }
      if (!conversationId) {
        const id = data.conversationId || crypto.randomUUID();
        const turnId = data.requestId || crypto.randomUUID();
        dispatch({ type: 'archive-chat', id, messages: [{ sender: 'user', id: `${turnId}-user`, requestId: turnId, text: message },
          { ...data, sender: 'ai', id: `${turnId}-ai`, requestId: turnId, text: data.response }] });
      }
      return data;
    }),
    getConsultationHistory: async (_limit, conversationId) => {
      const state = getState(); const turns = [];
      const currentId = state.chatId || state.id;
      const chats = { ...(state.conversations || {}), [currentId]: { messages: state.messages, updatedAt: state.conversations?.[currentId]?.updatedAt || state.startedAt } };
      for (const [id, chat] of Object.entries(chats)) {
        if (conversationId && conversationId !== id) continue;
        for (let i = 0; i < chat.messages.length; i++) {
          const item = chat.messages[i]; const reply = chat.messages[i + 1];
          if (item.sender === 'user' && reply?.sender === 'ai' && !reply.isError) turns.push({ historyId: reply.requestId || reply.id,
            conversationId: id, requestId: reply.requestId, userMessage: item.text, aiResponse: reply.text,
            responseMetadata: JSON.stringify(reply), createdAt: chat.updatedAt || state.startedAt || new Date().toISOString(), ragEnabled: reply.ragEnabled });
        }
      }
      return conversationId ? turns : turns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    deleteConsultationHistory: async id => dispatch({ type: 'remove-chat-turn', id }),
  };
  const scheduleService = {
    getAvailableSlots: async () => ({ availableSlots: ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'].map(startTime => ({ startTime })) }),
    createCaseAppointment: async data => {
      const legalCase = requireCase();
      const [time, period] = data.time.split(' '); let [hours, minutes] = time.split(':').map(Number);
      hours = hours % 12 + (period === 'PM' ? 12 : 0);
      const date = data.date; const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const bookingStartTime = `${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`;
      const appointment = { scheduleId: -Date.now(), bookingStartTime, bookingEndTime: new Date(new Date(bookingStartTime).getTime() + 3600000).toISOString(),
        lawyer: legalCase.lawyer, client: demoProfile, legalCase, status: 'PENDING', notes: data.notes };
      dispatch({ type: 'appointment', appointment }); return appointment;
    },
    cancelAppointment: async id => dispatch({ type: 'cancel-appointment', id }),
    rescheduleAppointment: async (id, clientId, date, time) => {
      const result = await scheduleService.createCaseAppointment({ clientId, date, time });
      dispatch({ type: 'cancel-appointment', id }); return result;
    },
  };
  scheduleService.createAppointment = scheduleService.createCaseAppointment;
  const listeners = new Set();
  const publish = messages => {
    for (const listener of listeners) listener.callback({ chatroomId: `demo-${listener.receiverId}`,
      messages: messages.filter(item => String(item.receiverId) === String(listener.receiverId))
        .map(item => ({ ...item, timestamp: new Date(item.createdAt) })) });
  };
  const messaging = {
    fetchActiveConversations: async () => (await loadLawyers()).map(lawyer => ({ id: lawyer.userId,
      name: `${lawyer.Fname} ${lawyer.Lname}`, role: 'LAWYER', accountType: 'LAWYER',
      chatroomId: `demo-${lawyer.userId}`, lastMessage: (getState().contactMessages || []).filter(item => String(item.receiverId) === String(lawyer.userId)).at(-1)?.content || '', isRead: true })),
    subscribeToMessages: (_sender, receiverId, callback) => {
      const listener = { receiverId, callback }; listeners.add(listener); publish(getState().contactMessages || []);
      return () => listeners.delete(listener);
    },
    sendMessage: async (senderId, receiverId, content) => {
      const messages = [...(getState().contactMessages || []), { id: crypto.randomUUID(), senderId, receiverId, content, createdAt: new Date().toISOString() }];
      dispatch({ type: 'contact-messages', messages }); publish(messages); return { chatroomId: `demo-${receiverId}` };
    },
    editMessage: async (_room, id, content) => {
      const messages = (getState().contactMessages || []).map(item => item.id === id ? { ...item, content } : item);
      dispatch({ type: 'contact-messages', messages }); publish(messages);
    },
    deleteMessage: async (_room, id) => {
      const messages = (getState().contactMessages || []).filter(item => item.id !== id);
      dispatch({ type: 'contact-messages', messages }); publish(messages);
    },
    markChatAsRead: async () => {},
  };
  return {
    auth: { userId: -1, accountType: 'CLIENT', isAuthenticated: true, email: demoProfile.email },
    get profile() { return getState().profile || demoProfile; },
    updateProfile: profile => dispatch({ type: 'profile', profile: { ...(getState().profile || demoProfile), ...profile } }),
    getUser: async id => id === -1 ? demoProfile : (await loadLawyers()).map(item => ({ ...item, id: item.userId,
      fullName: `${item.Fname} ${item.Lname}`, firstName: item.Fname, lastName: item.Lname })).find(item => String(item.id) === String(id)),
    path: demoPath, caseService, documentService, chatService, scheduleService, loadLawyers, messaging,
    hearingService,
    saveNotes: notes => dispatch({ type: 'save-notes', notes }), getNotes: () => getState().notes,
    visit: tab => dispatch({ type: 'visit', tab }),
    saveChat: chat => dispatch({ type: 'save-chat', chat }), getChat: () => ({ conversationId: getState().chatId || getState().id,
      messages: getState().messages, useRAG: getState().useRAG ?? false }),
    getSummary: () => getState().summary,
    getDocumentId: () => getState().document?.documentId || -1,
    getAppointments: () => getState().appointments || [],
  };
}
