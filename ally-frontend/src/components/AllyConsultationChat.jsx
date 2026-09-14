import { historyMessages, mergeHistory } from '../services/consultationHistory';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, MessageSquarePlus, History, RotateCcw, Trash2 } from 'lucide-react';
import { sendConsultationMessage, checkRagHealth, getConsultationHistory, deleteConsultationHistory } from '../services/allyConsultationService';
import MarkdownText from './shared/MarkdownText';

const storageKey = () => `ally-conversation:${localStorage.getItem('userId') || 'guest'}`;
const readSavedChat = () => {
  try { return JSON.parse(localStorage.getItem(storageKey())) || {}; }
  catch { return {}; }
};

const AllyConsultationChat = () => {
  const [savedChat] = useState(readSavedChat);
  const [conversationId, setConversationId] = useState(() => savedChat.conversationId || crypto.randomUUID());
  const activeConversation = useRef(conversationId);
  const [pending, setPending] = useState(localStorage.getItem('token') ? savedChat.pending || null : null);
  const [messages, setMessages] = useState(Array.isArray(savedChat.messages) ? savedChat.messages : []);
  const messageIdCounter = useRef(1);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasChatStarted, setHasChatStarted] = useState(Boolean(savedChat.messages?.length)); // Restore the active conversation
  const [useRAG, setUseRAG] = useState(savedChat.useRAG ?? true); // Persist case-search preference
  const [ragAvailable, setRagAvailable] = useState(true); // NEW: RAG service status
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const activeRequest = useRef(savedChat.pending?.requestId);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey(), JSON.stringify({ conversationId, messages, pending, useRAG })); }
    catch { console.error('Unable to save the local chat copy.'); }
  }, [conversationId, messages, pending, useRAG]);

  // Recover the server's saved reply even if the browser refreshed during generation.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let cancelled = false;
    let timer;
    const restore = async () => {
      try {
        const turns = await getConsultationHistory(100, conversationId);
        if (cancelled) return;
        const finished = pending && turns.some(turn => turn.requestId === pending.requestId);
        if (turns.length && (!pending || finished)) {
          setMessages(prev => mergeHistory(prev, turns));
          setHasChatStarted(true);
          if (finished) { setPending(null); setIsTyping(false); }
        }
        if (pending && !finished) {
          if (Date.now() - pending.startedAt > 600000) {
            setPending(null);
            setIsTyping(false);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'ai', text: 'The connection was interrupted before I could recover your answer. Your messages are saved. Please send your question again.' }]);
          } else timer = setTimeout(restore, 3000);
        }
      } catch (error) {
        if (!cancelled && pending) {
          if (error.response?.status === 401 || Date.now() - pending.startedAt > 600000) {
            setPending(null);
            setIsTyping(false);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'ai', text: 'Unable to recover the reply. Please check your connection and sign in again if your session expired. Your messages remain saved on this browser.' }]);
          } else timer = setTimeout(restore, 5000);
        }
      }
    };
    restore();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [conversationId, pending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // NEW: Check RAG service health on mount
  useEffect(() => {
    const checkRAG = async () => {
      const isHealthy = await checkRagHealth();
      setRagAvailable(isHealthy);
    };
    checkRAG();
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!localStorage.getItem('token')) return;

    setHistoryLoading(true);
    try {
      const historyItems = await getConsultationHistory(100);
      const conversations = new Map();
      for (const item of historyItems) {
        const key = item.conversationId || `legacy-${item.historyId}`;
        if (!conversations.has(key)) conversations.set(key, item);
      }
      setHistory([...conversations.values()]);
    } catch (error) {
      console.error('Error loading AI chat history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Listen for reset-chat event from sidebar
  useEffect(() => {
    const handleResetChat = () => {
      handleNewChat();
    };

    window.addEventListener('reset-chat', handleResetChat);
    
    return () => {
      window.removeEventListener('reset-chat', handleResetChat);
    };
  });

  const getAIResponse = async (userMessage, chatId, requestId) => {
    setIsTyping(true);
    let recovering = false;
    try {
      const data = await sendConsultationMessage(userMessage, useRAG, chatId, requestId, messages);
      
      if (activeConversation.current !== chatId || activeRequest.current !== requestId) return;
      // data is now always an object with { response, relevantCases, etc. }
      const aiMessage = {
        id: `msg-${Date.now()}-${messageIdCounter.current++}`,
        text: data.response,  // Changed from response.response to data.response
        sender: 'ai',
        requestId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relevantCases: data.relevantCases,
        caseCount: data.caseCount,
        confidence: data.confidence,
        ragEnabled: data.ragEnabled
      };
      
      setMessages(prev => [...prev.filter(message => !(message.sender === 'ai' && message.requestId === requestId)), aiMessage]);
      loadHistory();
    } catch {
      if (activeConversation.current !== chatId || activeRequest.current !== requestId) return;
      if (localStorage.getItem('token')) { recovering = true; return; }
      const errorMessage = {
        id: `msg-${Date.now()}-${messageIdCounter.current++}`,
        text: "Sorry, I'm having trouble connecting to the legal assistant. Please try again later.",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      if (!recovering && activeConversation.current === chatId && activeRequest.current === requestId) { setIsTyping(false); setPending(null); }
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() === '' || isTyping || pending) return;

    setHasChatStarted(true); // Mark chat as started
    setShowHistory(false);

    const requestId = crypto.randomUUID();
    const userMessage = {
      requestId,
      id: `msg-${Date.now()}-${messageIdCounter.current++}`,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    activeRequest.current = requestId;
    const pendingRequest = { requestId, startedAt: Date.now() };
    setPending(pendingRequest);
    // Save before starting the request so an immediate refresh retains the question.
    try { localStorage.setItem(storageKey(), JSON.stringify({ conversationId, messages: [...messages, userMessage], pending: pendingRequest, useRAG })); } catch { /* Server history remains available */ }
    getAIResponse(inputMessage, conversationId, requestId);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    const id = crypto.randomUUID();
    activeConversation.current = id;
    setConversationId(id);
    setMessages([]);
    setPending(null);
    setIsTyping(false);
    setInputMessage('');
    setHasChatStarted(false);
    setShowHistory(false);
    loadHistory();
  };

  const openHistoryItem = async (item) => {
    const id = item.conversationId || crypto.randomUUID();
    try {
      const turns = item.conversationId ? await getConsultationHistory(100, id) : [item];
      activeConversation.current = id;
      setConversationId(id);
      setPending(null);
      setIsTyping(false);
      setMessages(historyMessages(turns));
      setHasChatStarted(true);
      setShowHistory(false);
    } catch { alert('Unable to open this conversation. Please try again.'); }
  };

  const deleteHistoryItem = async (item, event) => {
    event.stopPropagation();

    const confirmed = window.confirm('Delete this AI chat from your history?');
    if (!confirmed) return;

    try {
      const turns = item.conversationId ? await getConsultationHistory(100, item.conversationId) : [item];
      await Promise.all(turns.map(turn => deleteConsultationHistory(turn.historyId)));
      if (item.conversationId === activeConversation.current) handleNewChat();
      setHistory(prev => prev.filter(historyItem => historyItem.historyId !== item.historyId));
      setMessages(prev => prev.filter(message =>
        message.id !== `history-user-${item.historyId}` && message.id !== `history-ai-${item.historyId}`
      ));
    } catch (error) {
      console.error('Error deleting AI chat history:', error);
      alert('Failed to delete AI chat history. Please try again.');
    }
  };

  return (
    <>
      {!hasChatStarted || showHistory ? (
        // INITIAL STATE - Before first message (centered)
        <div className="flex flex-col items-center justify-center min-h-[calc(90vh-64px)] px-4">
          {showHistory && messages.length > 0 && (
            <button onClick={() => setShowHistory(false)} className="mb-4 text-blue-600 hover:underline">Back to conversation</button>
          )}
          <h1 className="text-4xl font-semibold mb-8 text-center text-gray-800">
            How can <span className="text-blue-600">ALLY</span> help you today?
          </h1>
          
          <div className="w-full max-w-2xl">
            <div className="mb-3 flex items-center justify-end">
              <button
                onClick={() => setUseRAG(!useRAG)}
                disabled={!ragAvailable}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  useRAG
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={!ragAvailable ? 'RAG service unavailable' : 'Toggle case search'}
              >
                <Search className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {ragAvailable ? (useRAG ? 'Case Search: ON' : 'Case Search: OFF') : 'Case Search Unavailable'}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-3 bg-white border-2 border-gray-300 rounded-full px-6 py-2 shadow-lg hover:shadow-xl transition-shadow">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask any legal question here..."
                className="min-w-0 flex-1 outline-none text-base bg-transparent"
                disabled={isTyping || Boolean(pending)}
              />
              <button
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === '' || isTyping || Boolean(pending)}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="w-full max-w-2xl mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent AI Chats
                </h2>
                <button
                  onClick={loadHistory}
                  className="p-2 text-gray-500 hover:text-blue-600"
                  title="Refresh history"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white max-h-64 overflow-y-auto">
                {history.slice(0, 8).map((item) => (
                  <div
                    key={item.historyId}
                    onClick={() => openHistoryItem(item)}
                    className="flex items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.userMessage}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {item.ragEnabled ? ' · Case search used' : ''}
                      </p>
                    </div>
                    <button
                      onClick={(event) => deleteHistoryItem(item, event)}
                      className="p-2 text-gray-400 rounded-md hover:text-red-600 hover:bg-red-50"
                      title="Delete AI chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ACTIVE CHAT STATE - After first message (clean, minimal design)
        <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-4 py-8">
            <div className="flex min-h-full flex-col justify-end space-y-6">
              {messages.map((message) => (
                <div key={message.id} className="min-w-0">
                  {/* Main Message */}
                  <div className={`flex min-w-0 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[min(42rem,85%)] break-words px-5 py-3 rounded-3xl [overflow-wrap:anywhere] ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <MarkdownText text={message.text} className="text-sm leading-relaxed" />
                    </div>
                  </div>

                  {/* Display Relevant Cases if RAG was used */}
                  {message.sender === 'ai' && message.ragEnabled && (
                    <div className="mt-3 ml-0 min-w-0">
                      {message.relevantCases && message.relevantCases.length > 0 ? (
                        // Show cases if found above threshold
                        <div className="max-w-[min(42rem,85%)] overflow-hidden break-words p-4 bg-blue-50 rounded-2xl [overflow-wrap:anywhere]">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1 min-w-0">
                              <Search className="w-3 h-3" />
                              Found {message.caseCount} Relevant Case{message.caseCount > 1 ? 's' : ''}
                            </h4>
                            {message.confidence && message.confidence !== 'Low relevance' && (
                              <span className="text-xs text-blue-700 font-medium">
                                ✓ {message.confidence}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {message.relevantCases.map((legalCase, idx) => (
                              <div key={idx} className="min-w-0 p-3 bg-white rounded-xl">
                                <p className="text-xs font-semibold text-gray-800">
                                  {idx + 1}. {legalCase.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Relevance: {legalCase.score?.toFixed(1)}%
                                </p>
                                {legalCase.citation && (
                                  <p className="text-xs text-gray-500 mt-1 italic">
                                    {legalCase.citation}
                                  </p>
                                )}
                                {typeof legalCase.source_url === 'string' && legalCase.source_url.trim() && (
                                  <a
                                    href={legalCase.source_url.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline mt-2 inline-block break-all"
                                  >
                                    View Official Supreme Court Decision
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : message.confidence === 'Low relevance' || message.caseCount === 0 ? (
                        // Show "no relevant cases" message
                        <div className="max-w-[min(42rem,85%)] break-words p-4 bg-red-50 rounded-2xl [overflow-wrap:anywhere]">
                          <div className="flex items-center gap-2 mb-2">
                            <Search className="w-4 h-4 text-red-600" />
                            <h4 className="text-xs font-semibold text-red-800">
                              No Highly Relevant Cases Found
                            </h4>
                          </div>
                          <p className="text-xs text-red-700 leading-relaxed">
                            The search didn't find cases with high relevance (≥54%) to your question. 
                            <br />
                            <strong>Try:</strong> Providing more specific details, using legal terms, or specifying the area of law.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
        
              {(isTyping || pending) && (
                <div className="flex justify-start">
                  <div className="px-5 py-3 bg-gray-100 rounded-3xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
        
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="shrink-0 bg-white border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              {/* Controls Row: RAG Toggle and New Chat */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <button
                    onClick={() => setUseRAG(!useRAG)}
                    disabled={!ragAvailable}
                    className={`flex max-w-full items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                      useRAG 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={!ragAvailable ? 'RAG service unavailable' : 'Toggle case search'}
                  >
                    <Search className="w-4 h-4" />
                    <span className="truncate text-sm font-medium">
                      {useRAG ? 'Case Search: ON' : 'Search for Relevant Cases'}
                    </span>
                  </button>
                  
                  {/* New Chat Button - Visible to ALL users */}
                  <button
                    onClick={handleNewChat}
                    className="flex max-w-full items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    title="Start a new conversation"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    <span className="truncate text-sm font-medium">New Chat</span>
                  </button>

                  <button
                    onClick={() => { loadHistory(); setShowHistory(true); }}
                    className="flex max-w-full items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    title="Refresh AI chat history"
                  >
                    <History className="w-4 h-4" />
                    <span className="truncate text-sm font-medium">
                      {historyLoading ? 'Loading...' : `${history.length} Saved`}
                    </span>
                  </button>
                </div>
                
                {!ragAvailable && (
                  <span className="text-xs text-red-500">⚠️ Search unavailable</span>
                )}
              </div>

              {/* Input Row */}
              <div className="flex items-center gap-3 bg-white border border-gray-300 rounded-full px-4 py-2 shadow-sm">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask any legal question here..."
                  className="min-w-0 flex-1 outline-none text-sm bg-transparent"
                  disabled={isTyping || Boolean(pending)}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={inputMessage.trim() === '' || isTyping || Boolean(pending)}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Disclaimer */}
              <p className="mt-3 text-xs text-center text-gray-500">
                AI-generated insights are not a substitute for professional legal advice and may be inaccurate. Always confirm details with a qualified lawyer.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AllyConsultationChat;
