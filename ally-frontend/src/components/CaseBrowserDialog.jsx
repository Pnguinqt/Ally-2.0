import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/modalScrollLock.js';

export default function CaseBrowserDialog({ children, onClose }) {
  const dialogRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    lockBodyScroll();
    return () => {
      dialog.close();
      unlockBodyScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const keepFocusInDialog = event => {
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll('button, input, select, [tabindex]')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  };

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="case-browser-title" aria-describedby="case-browser-description"
      onKeyDown={keepFocusInDialog} onCancel={event => { event.preventDefault(); onClose(); }}
      className={`fixed p-0 border border-gray-200 bg-white shadow-2xl backdrop:bg-gray-900/40 ${fullscreen
        ? 'inset-0 m-0 h-[100dvh] w-screen max-h-none max-w-none'
        : 'inset-0 m-auto h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl rounded-xl'}`}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 shrink-0 sm:px-6">
          <div>
            <h2 id="case-browser-title" className="text-lg font-semibold text-gray-900">Browse cases</h2>
            <p id="case-browser-description" className="mt-1 text-sm text-gray-500">Find a case and select it to open its workspace.</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={() => setFullscreen(value => !value)}
              aria-label={fullscreen ? 'Use floating window' : 'Open fullscreen'} title={fullscreen ? 'Use floating window' : 'Open fullscreen'}
              className="p-2 text-gray-500 rounded-lg hover:bg-gray-100">
              {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button type="button" onClick={onClose} aria-label="Close case browser" title="Close case browser"
              className="p-2 text-gray-500 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
        </header>
        {children}
      </div>
    </dialog>, document.body
  );
}
