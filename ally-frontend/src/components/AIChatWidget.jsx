import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Bot, Maximize2, Minimize2, Minus } from 'lucide-react';
import AllyConsultationChat from './AllyConsultationChat.jsx';

export default function AIChatWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    const openChat = () => { setHasOpened(true); setOpen(true); };
    const closeChat = () => setOpen(false);
    window.addEventListener('open-ai-chat', openChat);
    window.addEventListener('close-ai-chat', closeChat);
    return () => {
      window.removeEventListener('open-ai-chat', openChat);
      window.removeEventListener('close-ai-chat', closeChat);
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('assistant') === 'open') {
      setHasOpened(true);
      setOpen(true);
    }
  }, [location.key, location.search]);

  useEffect(() => {
    if (open) {
      window.dispatchEvent(new Event('ai-chat-opened'));
      panelRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }
  }, [open]);

  const minimize = () => {
    setOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      {hasOpened && createPortal(<section id="ally-ai-widget" ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="ally-ai-widget-title"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            if (expanded) setExpanded(false);
            else minimize();
          }
        }}
        className={`${open ? 'flex' : 'hidden'} fixed bottom-20 right-4 z-[60] ${expanded ? 'left-4 top-4' : 'h-[min(600px,calc(100dvh-7rem))] w-[calc(100%-2rem)] max-w-[440px]'} min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl`}>
        <header className="flex items-center gap-3 px-4 py-3 text-white bg-blue-600 shrink-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15"><Bot className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="ally-ai-widget-title" className="text-sm font-semibold">ALLY AI Assistant</h2>
            <p className="text-xs text-blue-100">Ask a question while you work</p>
          </div>
          <button type="button" onClick={() => setExpanded(value => !value)}
            aria-label={expanded ? 'Restore AI chat size' : 'Expand AI chat'} aria-pressed={expanded}
            title={expanded ? 'Restore AI chat size' : 'Expand AI chat'}
            className="p-2 rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            {expanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button type="button" onClick={minimize} aria-label="Minimize AI chat" title="Minimize AI chat"
            className="p-2 rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Minus className="w-5 h-5" /></button>
        </header>
        <AllyConsultationChat embedded visible={open} />
      </section>, document.body)}
      <button ref={launcherRef} type="button" aria-label={open ? 'Minimize AI chat' : 'Open AI chat'} aria-expanded={open}
        aria-controls={hasOpened ? 'ally-ai-widget' : undefined}
        onClick={() => { if (open) minimize(); else { setHasOpened(true); setOpen(true); } }}
        title={open ? 'Minimize AI chat' : 'Ask ALLY'}
        className="fixed flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full shadow-lg bottom-4 right-4 z-[60] hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <Bot className="w-5 h-5" aria-hidden="true" /><span className="hidden sm:inline">Ask ALLY</span>
      </button>
    </>
  );
}
