import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, MessageSquarePlus, History, RotateCcw, Trash2 } from 'lucide-react';
import { sendConsultationMessage, checkRagHealth, getConsultationHistory, deleteConsultationHistory } from '../services/allyConsultationService';
import MarkdownText from './shared/MarkdownText';

const AllyConsultationChat = () => {
  const [messages, setMessages] = useState([]);
  const messageIdCounter = useRef(1);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasChatStarted, setHasChatStarted] = useState(false); // Track if user has sent first message
  const [useRAG, setUseRAG] = useState(true); // NEW: RAG toggle state
  const [ragAvailable, setRagAvailable] = useState(true); // NEW: RAG service status
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      const historyItems = await getConsultationHistory(50);
      setHistory(historyItems);
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
  }, []);

  const getAIResponse = async (userMessage) => {
    setIsTyping(true);
    
    try {
      const data = await sendConsultationMessage(userMessage, useRAG);
      
      // data is now always an object with { response, relevantCases, etc. }
      const aiMessage = {
        id: `msg-${Date.now()}-${messageIdCounter.current++}`,
        text: data.response,  // Changed from response.response to data.response
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relevantCases: data.relevantCases,
        caseCount: data.caseCount,
        confidence: data.confidence,
        ragEnabled: data.ragEnabled
      };
      
      setMessages(prev => [...prev, aiMessage]);
      loadHistory();
    } catch {
      const errorMessage = {
        id: `msg-${Date.now()}-${messageIdCounter.current++}`,
        text: "Sorry, I'm having trouble connecting to the legal assistant. Please try again later.",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;

    setHasChatStarted(true); // Mark chat as started

    const userMessage = {
      id: `msg-${Date.now()}-${messageIdCounter.current++}`,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    getAIResponse(inputMessage);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/reset`, {
        method: 'GET',
      });
      setMessages([]);
      messageIdCounter.current = 1;
      setHasChatStarted(false); // Reset to initial centered state
    } catch (error) {
      console.error('Error resetting chat:', error);
    }
  };

  const openHistoryItem = (item) => {
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const timestamp = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages([
      {
        id: `history-user-${item.historyId}`,
        text: item.userMessage,
        sender: 'user',
        timestamp
      },
      {
        id: `history-ai-${item.historyId}`,
        text: item.aiResponse,
        sender: 'ai',
        timestamp,
        relevantCases: null,
        caseCount: item.caseCount,
        confidence: item.confidence,
        ragEnabled: item.ragEnabled
      }
    ]);
    setHasChatStarted(true);
  };

  const deleteHistoryItem = async (item, event) => {
    event.stopPropagation();

    const confirmed = window.confirm('Delete this AI chat from your history?');
    if (!confirmed) return;

    try {
      await deleteConsultationHistory(item.historyId);
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
      {!hasChatStarted ? (
        // INITIAL STATE - Before first message (centered)
        <div className="flex flex-col items-center justify-center min-h-[calc(90vh-64px)] px-4">
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
                className="flex-1 outline-none text-base bg-transparent"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === '' || isTyping}
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
        <div className="w-full min-h-[calc(100vh-64px)] flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-8 max-w-4xl mx-auto w-full">
            <div className="flex flex-col justify-end min-h-full space-y-6">
              {messages.map((message) => (
                <div key={message.id}>
                  {/* Main Message */}
                  <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-2xl px-5 py-3 rounded-3xl ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <MarkdownText text={message.text} className="text-sm leading-relaxed" />
                    </div>
                  </div>

                  {/* Display Relevant Cases if RAG was used */}
                  {message.sender === 'ai' && message.ragEnabled && (
                    <div className="mt-3 ml-0">
                      {message.relevantCases && message.relevantCases.length > 0 ? (
                        // Show cases if found above threshold
                        <div className="max-w-2xl p-4 bg-blue-50 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1">
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
                              <div key={idx} className="p-3 bg-white rounded-xl">
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
                                    className="text-xs text-blue-600 hover:underline mt-2 inline-block"
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
                        <div className="max-w-2xl p-4 bg-red-50 rounded-2xl">
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
        
              {isTyping && (
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
          <div className="bg-white border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              {/* Controls Row: RAG Toggle and New Chat */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
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
                      {useRAG ? 'Case Search: ON' : 'Search for Relevant Cases'}
                    </span>
                  </button>
                  
                  {/* New Chat Button - Visible to ALL users */}
                  <button
                    onClick={handleNewChat}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    title="Start a new conversation"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Chat</span>
                  </button>

                  <button
                    onClick={loadHistory}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    title="Refresh AI chat history"
                  >
                    <History className="w-4 h-4" />
                    <span className="text-sm font-medium">
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
                  className="flex-1 outline-none text-sm bg-transparent"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={inputMessage.trim() === '' || isTyping}
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
