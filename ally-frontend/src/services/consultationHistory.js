export const historyMessages = (turns) => turns.flatMap(item => {
  let metadata = {};
  try { metadata = JSON.parse(item.responseMetadata || '{}'); } catch { /* Legacy history */ }
  const timestamp = new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return [
    { id: `history-user-${item.historyId}`, text: item.userMessage, sender: 'user', timestamp, requestId: item.requestId },
    { ...metadata, id: `history-ai-${item.historyId}`, text: item.aiResponse, sender: 'ai', timestamp,
      requestId: item.requestId, caseCount: item.caseCount, confidence: item.confidence, ragEnabled: item.ragEnabled }
  ];
});

export const mergeHistory = (messages, turns) => {
  const savedIds = new Set(turns.map(turn => turn.requestId));
  return [...historyMessages(turns), ...messages.filter(message => message.requestId && !savedIds.has(message.requestId))];
};
