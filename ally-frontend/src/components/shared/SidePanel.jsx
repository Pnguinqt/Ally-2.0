import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/modalScrollLock.js';

export default function SidePanel({ title, description, onClose, busy = false, children }) {
  const dialogRef = useRef(null);

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

  const keepFocusInPanel = event => {
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll('button, input, textarea, select, a[href], [tabindex]')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="side-panel-title" aria-describedby="side-panel-description"
      onKeyDown={keepFocusInPanel}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!busy && event.target === event.currentTarget && event.clientX < bounds.left) onClose();
      }}
      className="fixed inset-y-0 right-0 left-auto w-full h-[100dvh] max-h-none max-w-lg m-0 p-0 border-0 bg-white shadow-2xl backdrop:bg-gray-900/40">
      <div className="flex flex-col h-full">
        <header className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="side-panel-title" className="text-lg font-semibold text-gray-900">{title}</h2>
            <p id="side-panel-description" className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <button type="button" disabled={busy} aria-label="Close panel" onClick={onClose}
            className="p-2 text-gray-500 rounded-md hover:bg-gray-100 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </header>
        {children}
      </div>
    </dialog>, document.body
  );
}
