import React, { useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, Maximize2, PanelLeftClose, PanelLeftOpen, Search, UserRound } from 'lucide-react';
import CaseBrowserDialog from './CaseBrowserDialog.jsx';
import { caseActivityTimestamp, organizeWorkspaceCases } from '../utils/workspaceCases.js';

const clientName = item => `${item.client?.Fname || ''} ${item.client?.Lname || ''}`.trim() || 'Unknown client';
// Missing participant records stay separate instead of combining unrelated cases.
const clientKey = item => String(item.client?.userId ?? item.client?.email ?? `case-${item.caseId}`);

export default function WorkspaceCaseSidebar({ cases, isLawyer, activeTab, onTabChange, selectedCaseId, onSelect, collapsed, onToggleCollapsed }) {
  const [filterBy, setFilterBy] = useState('case');
  const [selectedClient, setSelectedClient] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState('recent');
  const activeCases = cases.filter(item => (item.status === 'COMPLETED') === (activeTab === 'completed'));
  const clients = useMemo(() => [...new Map(cases.map(item => [clientKey(item), {
    id: clientKey(item), name: clientName(item),
  }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [cases]);
  const byClient = isLawyer && filterBy === 'client';
  const term = search.trim().toLowerCase();
  const filtered = organizeWorkspaceCases(activeCases.filter(item =>
    (!byClient || !selectedClient || clientKey(item) === selectedClient) &&
    [item.title, item.caseId, item.caseType, item.status, ...(byClient ? [clientName(item)] : [])]
      .some(value => String(value ?? '').toLowerCase().includes(term))
  ), order);
  const groups = byClient
    ? clients.map(client => ({ ...client, cases: filtered.filter(item => clientKey(item) === client.id) })).filter(group => group.cases.length)
    : [{ id: 'cases', cases: filtered }];
  const hasFilters = Boolean(search || (byClient && selectedClient) || order === 'week' || order === 'month');

  const directory = <>
      <div className={expanded ? 'grid items-start gap-4 p-4 border-b border-gray-100 shrink-0 sm:grid-cols-2 lg:grid-cols-3 sm:px-6' : 'p-4 space-y-4 border-b border-gray-100 shrink-0'}>
        {isLawyer && (
          <div>
            <label htmlFor="workspace-filter-by" className="sr-only">Filter directory by</label>
            <select id="workspace-filter-by" value={filterBy} onChange={event => {
              setFilterBy(event.target.value); setSelectedClient(''); setSearch('');
            }} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500">
              <option value="case">Filter by Case</option>
              <option value="client">Filter by Client</option>
            </select>
          </div>
        )}
        {byClient && (
          <div>
            <label htmlFor="workspace-client-filter" className="block mb-1.5 text-xs font-medium text-gray-600">Client</label>
            <select id="workspace-client-filter" value={selectedClient} onChange={event => setSelectedClient(event.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500">
              <option value="">All clients</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" aria-label="Case status">
          {[['recent', 'Active'], ['completed', 'Completed']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => onTabChange(id,
              cases.filter(item => !byClient || !selectedClient || clientKey(item) === selectedClient))}
              className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors ${activeTab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}>
              {label} <span className="ml-1 text-[11px] opacity-70">{cases.filter(item =>
                (item.status === 'COMPLETED') === (id === 'completed') && (!byClient || !selectedClient || clientKey(item) === selectedClient)).length}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
          <input aria-label={byClient ? 'Search clients or cases' : 'Search cases'} value={search} onChange={event => setSearch(event.target.value)}
            placeholder={byClient ? 'Search clients or cases' : 'Search cases by name or ID'}
            className="w-full py-2 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="workspace-case-order" className="block mb-1.5 text-xs font-medium text-gray-600">Organize cases</label>
          <select id="workspace-case-order" value={order} onChange={event => setOrder(event.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500">
            <option value="recent">Recent</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="case">By Case (A–Z)</option>
          </select>
          <p className="mt-1 text-[11px] text-gray-500">{order === 'case' ? 'Sorted by case title.' : order === 'week' ? 'Updated in the last 7 days.' : order === 'month' ? 'Updated in the last 30 days.' : 'Latest case updates first.'}</p>
        </div>
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${expanded ? 'p-4 sm:px-6' : 'max-h-64 p-2 lg:max-h-none'}`}>
        <p className="px-2 py-2 text-[11px] font-medium tracking-wide text-gray-500 uppercase" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'case' : 'cases'}
        </p>
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-gray-500">{hasFilters ? 'No cases match your filters.' : `No ${activeTab === 'recent' ? 'active' : 'completed'} cases yet.`}</p>
            {hasFilters && <button type="button" onClick={() => { setSearch(''); setSelectedClient(''); setOrder('recent'); }}
              className="mt-3 text-sm font-medium text-blue-600 hover:underline">Clear filters</button>}
          </div>
        ) : groups.map(group => (
          <div key={group.id} className="mb-2">
            {byClient && <h3 className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-gray-600">
              <UserRound className="w-3.5 h-3.5 shrink-0" /><span className="break-words">{group.name}</span>
              <span className="ml-auto text-gray-400">{group.cases.length}</span>
            </h3>}
            <div className={expanded ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : ''}>
            {group.cases.map(item => {
              const selected = Number(selectedCaseId) === Number(item.caseId);
              return (
                <button key={item.caseId} type="button" aria-pressed={selected} onClick={() => { onSelect(item.caseId); setExpanded(false); }}
                  className={`w-full p-3 ${expanded ? '' : 'mb-2'} text-left border rounded-lg transition-colors focus-visible:outline-blue-500 ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-semibold leading-5 text-gray-900 break-words min-w-0">{item.title || `Case #${item.caseId}`}</span>
                    {selected && <Check aria-label="Selected case" className="w-4 h-4 mt-0.5 ml-auto text-blue-600 shrink-0" />}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">#{item.caseId} · {item.caseType || 'General'}</p>
                  {isLawyer && !byClient && <p className="mt-1 text-xs text-gray-500 break-words">{clientName(item)}</p>}
                  <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded-full ${item.status === 'ACCEPTED' ? 'bg-green-50 text-green-700' : item.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {String(item.status || 'Unknown').toLowerCase().replaceAll('_', ' ')}
                  </span>
                  {expanded && <p className="mt-2 text-xs text-gray-500">{caseActivityTimestamp(item) !== null
                    ? `Updated ${new Date(caseActivityTimestamp(item)).toLocaleDateString()}` : 'Update date unavailable'}</p>}
                </button>
              );
            })}
            </div>
          </div>
        ))}
      </div>
  </>;

  return (
    <>
    <aside aria-label={isLawyer ? 'Client and case navigation' : 'My cases'}
      className="flex min-h-0 flex-col overflow-hidden bg-white border border-gray-200 rounded-xl">
      <div className={`flex gap-1 p-3 border-b border-gray-100 ${collapsed ? 'items-center lg:flex-col' : 'items-center'}`}>
        {!collapsed && <>
          <BriefcaseBusiness className="w-4 h-4 text-blue-600 shrink-0" />
          <h2 className="mr-auto text-sm font-semibold text-gray-900">{isLawyer ? 'Case directory' : 'My cases'}</h2>
        </>}
        {collapsed && <span className="mr-auto text-sm font-semibold text-gray-900 lg:hidden">Cases</span>}
        <button type="button" onClick={() => setExpanded(true)} aria-label="Open case browser" title="Open case browser"
          className="p-2 text-gray-500 rounded-lg hover:bg-gray-100"><Maximize2 className="w-4 h-4" /></button>
        <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand case sidebar' : 'Collapse case sidebar'}
          aria-expanded={!collapsed} title={collapsed ? 'Expand case sidebar' : 'Collapse case sidebar'}
          className="p-2 text-gray-500 rounded-lg hover:bg-gray-100">
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
      {!collapsed && !expanded && directory}
    </aside>
    {expanded && <CaseBrowserDialog onClose={() => setExpanded(false)}>{directory}</CaseBrowserDialog>}
    </>
  );
}
