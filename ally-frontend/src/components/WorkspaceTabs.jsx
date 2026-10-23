import { useEffect, useRef } from 'react';
import { Bot, CalendarDays, FileText, LayoutDashboard, NotebookPen } from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'hearings', label: 'Hearings', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
];

export default function WorkspaceTabs({ activeTab, onChange, documentCount }) {
  const tabListRef = useRef(null);

  useEffect(() => {
    const list = tabListRef.current;
    const revealActiveTab = () => {
      const selected = list.querySelector('[aria-selected="true"]');
      if (!selected) return;
      const bounds = list.getBoundingClientRect();
      const tabBounds = selected.getBoundingClientRect();
      if (tabBounds.left < bounds.left) list.scrollLeft -= bounds.left - tabBounds.left;
      else if (tabBounds.right > bounds.right) list.scrollLeft += tabBounds.right - bounds.right;
    };
    revealActiveTab();
    const observer = new ResizeObserver(revealActiveTab);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTab]);

  const handleKeyDown = event => {
    const current = tabs.findIndex(tab => tab.id === activeTab);
    let next;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next].focus();
  };

  return (
    <div ref={tabListRef} role="tablist" aria-label="Case workspace" onKeyDown={handleKeyDown}
      className="flex gap-1 px-2 overflow-x-auto border-t border-gray-100 sm:px-4">
      {tabs.map(({ id, label, icon }) => {
        const Icon = icon;
        return (
          <button key={id} id={`workspace-tab-${id}`} type="button" role="tab"
            aria-selected={activeTab === id} aria-controls={`workspace-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1} onClick={() => onChange(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-500 ${
              activeTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-900'
            }`}>
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
            {id === 'documents' && <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-600">{documentCount}</span>}
          </button>
        );
      })}
    </div>
  );
}
