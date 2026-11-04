import { useEffect, useRef } from 'react';
import { ClipboardList, X } from 'lucide-react';

export default function QuestWindow({ open, onClose, children }) {
  const windowRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    windowRef.current?.focus({ preventScroll: true });
  }, [open]);

  const closeWindow = () => {
    const shouldRestoreFocus = windowRef.current?.contains(document.activeElement);
    onClose();
    if (shouldRestoreFocus && triggerRef.current instanceof HTMLElement && triggerRef.current.isConnected) {
      triggerRef.current.focus({ preventScroll: true });
    }
  };

  return <section id="demo-quest-window" ref={windowRef} role="dialog" aria-modal="false"
    aria-labelledby="demo-quest-window-title" aria-describedby="demo-quest-window-description" tabIndex={-1}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeWindow(); }
    }}
    className={`fixed bottom-20 left-4 z-[55] w-[360px] max-w-[calc(100vw-2rem)] max-h-[min(34rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xl focus:outline-none ${open ? 'flex' : 'hidden'}`}
    data-no-translate>
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
      <div><h2 id="demo-quest-window-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ClipboardList className="h-4 w-4 text-blue-600" aria-hidden="true" />Demo quests</h2>
        <p id="demo-quest-window-description" className="mt-1 text-xs leading-5 text-gray-500">Keep this open while you try ALLY.</p></div>
      <button type="button" aria-label="Close quests" onClick={closeWindow}
        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-4 w-4" aria-hidden="true" /></button>
    </header>
    {children}
  </section>;
}
