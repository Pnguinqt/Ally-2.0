import React, { useState } from 'react';
import Avatar from './Avatar';
import MarkdownText from '../shared/MarkdownText';

// Message Bubble Component
const MessageBubble = ({ message, isOwn, senderName, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveEdit = async event => {
    event.preventDefault();
    if (!editContent.trim() || saving) return;
    if (editContent.trim() === message.content) { setEditing(false); return; }
    setSaving(true); setError('');
    try {
      const result = await onEdit(editContent.trim());
      if (result === false) throw new Error('Could not save this edit. Please try again.');
      setEditing(false);
    } catch (error) { setError(error.message || 'Could not save this edit.'); }
    finally { setSaving(false); }
  };

  return (
    <article aria-label={isOwn ? 'Your message' : `Message from ${senderName || 'contact'}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}>
      {!isOwn && (
        <div className="flex-shrink-0 mt-1 mr-2">
          <Avatar name={senderName} size="sm" />
        </div>
      )}
      
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`relative px-4 py-2.5 ${
            isOwn
              ? 'bg-blue-500 text-primary-foreground rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl'
              : 'bg-muted text-muted-foreground rounded-tr-2xl rounded-tl-2xl rounded-br-2xl'
          }`}
        >
          {editing ? <form onSubmit={saveEdit} className="min-w-[180px] space-y-2">
            <textarea aria-label="Edit message" autoFocus value={editContent} disabled={saving} rows={3}
              onChange={event => setEditContent(event.target.value)} className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900" />
            {error && <p role="alert" className="text-xs text-white">{error}</p>}
            <div className="flex gap-2"><button type="submit" disabled={saving || !editContent.trim()} className="rounded bg-white px-3 py-1 text-xs font-medium text-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save edit'}</button>
              <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded px-3 py-1 text-xs text-white">Cancel</button></div>
          </form> : <MarkdownText text={message.content} className="text-sm leading-relaxed break-words" />}
          
          {message.hasFile && message.fileName && (
            <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 ${
              isOwn ? 'bg-primary/90' : 'bg-white'
            }`}>
              <div className={`p-2 rounded flex-shrink-0 ${isOwn ? 'bg-primary-foreground' : 'bg-muted/20'}`}>
                <svg className={`w-4 h-4 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  {message.fileName}
                </p>
                <p className={`text-xs ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {message.fileSize}
                </p>
              </div>
            </div>
          )}
          
          <div className={`flex items-center gap-1 mt-1 text-xs ${
            isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'
          }`}>
            <span>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.isEdited && <span>· Edited</span>}
          </div>

          {isOwn && !editing && (
            <div className="mt-2 flex justify-end gap-2 rounded-lg bg-white px-2 py-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
              <button
                onClick={() => { setEditContent(message.content); setError(''); setEditing(true); }}
                className="px-2 py-1 text-xs text-gray-600 rounded hover:text-gray-900 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="px-2 py-1 text-xs text-red-600 rounded hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default MessageBubble;
