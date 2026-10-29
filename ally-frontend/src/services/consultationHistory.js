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
  if (!messages.length) return historyMessages(turns);

  const savedByRequest = new Map();
  const legacyMessages = [];

  for (const turn of turns) {
    const savedMessages = historyMessages([turn]);
    if (turn.requestId) savedByRequest.set(turn.requestId, savedMessages);
    else legacyMessages.push(...savedMessages);
  }

  const merged = [...legacyMessages];
  const insertedRequests = new Set();

  // Keep the browser's visible conversation order. When a pending/local turn
  // has reached the server, replace it in place instead of moving it above
  // older unsaved errors or messages.
  for (const message of messages) {
    const savedMessages = message.requestId && savedByRequest.get(message.requestId);
    if (!savedMessages) {
      merged.push(message);
      continue;
    }

    if (!insertedRequests.has(message.requestId)) {
      merged.push(...savedMessages);
      insertedRequests.add(message.requestId);
    }
  }

  // Include server turns that are not present in the browser copy, such as a
  // response recovered after a refresh.
  for (const turn of turns) {
    if (turn.requestId && !insertedRequests.has(turn.requestId)) {
      merged.push(...(savedByRequest.get(turn.requestId) || []));
    }
  }

  return merged;
};
