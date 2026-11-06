import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Calendar, CheckCircle2, Circle, Clock3, FileText, Loader2, NotebookPen, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { caseService as productionCaseService } from '../services/caseService.jsx';
import { documentService as productionDocumentService } from '../services/documentService.js';
import { useDemoRuntime } from '../demo/DemoContext';
import { useSearchParams } from 'react-router-dom';
import { getAuthData } from '../utils/auth.jsx';
import CaseDocumentManager from '../components/CaseDocumentManager.jsx';
import CaseHearingCalendar from '../components/CaseHearingCalendar.jsx';
import WorkspaceTabs from '../components/WorkspaceTabs.jsx';
import WorkspaceCaseSidebar from '../components/WorkspaceCaseSidebar.jsx';
import { workspaceCaseGroup } from '../utils/workspaceCases.js';

const LegalWorkspacePage = () => {
  const demo = useDemoRuntime();
  const caseService = demo?.caseService || productionCaseService;
  const documentService = demo?.documentService || productionDocumentService;
  const [searchParams] = useSearchParams();
  const [authData, setAuthData] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [documentCounts, setDocumentCounts] = useState({});
  const [notes, setNotes] = useState('');
  const [caseListTab, setCaseListTab] = useState('recent');
  const [caseSidebarCollapsed, setCaseSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [acceptingCaseId, setAcceptingCaseId] = useState(null);
  const acceptingCase = useRef(false);
  const [documentPinNotice, setDocumentPinNotice] = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ai') setActiveTab('overview');
    else if (demo && ['overview', 'hearings', 'documents', 'notes'].includes(tab)) setActiveTab(tab);
  }, [demo, searchParams]);

  useEffect(() => {
    if (demo && selectedCaseId) demo.visit(activeTab);
  }, [demo, selectedCaseId, activeTab]);

  useEffect(() => {
    const auth = demo?.auth || getAuthData();
    if (!auth) {
      toast.error('Please log in to open your legal workspace');
      setLoading(false);
      return;
    }
    setAuthData(auth);
  }, []);

  useEffect(() => {
    if (!authData) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const caseList = authData.accountType === 'LAWYER'
          ? await caseService.getLawyerCases(authData.userId)
          : await caseService.getClientCases(authData.userId);
        if (!active) return;
        const visibleCases = sortCasesByRecency((caseList || []).filter(item => workspaceCaseGroup(item) !== null));
        const initialTab = ['recent', 'completed', 'declined'].find(group =>
          visibleCases.some(item => workspaceCaseGroup(item) === group)) || 'recent';
        const initialCases = visibleCases.filter(item => workspaceCaseGroup(item) === initialTab);
        setCases(visibleCases);
        setCaseListTab(initialTab);
        setSelectedCaseId(initialCases[0]?.caseId || null);
        const counts = await Promise.all(visibleCases.map(async item =>
          [item.caseId, await documentService.getDocumentCount(item.caseId)]));
        if (!active) return;
        setDocumentCounts(Object.fromEntries(counts));
      } catch (error) {
        if (active) {
          console.error('Error loading legal workspace:', error);
          toast.error('Failed to load legal workspace');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [authData]);

  useEffect(() => {
    if (!authData || !selectedCaseId) {
      setNotes('');
      return;
    }

    setNotes(demo ? demo.getNotes() : localStorage.getItem(getNotesKey(selectedCaseId, authData.userId)) || '');
  }, [selectedCaseId, authData]);

  const refreshDocumentCount = async caseId => {
    try {
      const count = await documentService.getDocumentCount(caseId);
      setDocumentCounts(current => ({ ...current, [caseId]: count }));
    } catch (error) {
      console.error('Error refreshing document count:', error);
    }
  };

  const selectedCase = useMemo(
    () => cases.find(caseItem => caseItem.caseId === Number(selectedCaseId)),
    [cases, selectedCaseId]
  );

  const changeCaseListTab = (nextTab, scopedCases = cases) => {
    const nextCases = cases.filter(item => workspaceCaseGroup(item) === nextTab)
      .filter(item => scopedCases.some(candidate => candidate.caseId === item.caseId));
    setCaseListTab(nextTab);
    setSelectedCaseId(current => nextCases.some(item => item.caseId === Number(current))
      ? current
      : nextCases[0]?.caseId || null);
  };

  const saveNotes = (value) => {
    setNotes(value);
    if (!authData || !selectedCaseId) return;
    if (demo) demo.saveNotes(value);
    else localStorage.setItem(getNotesKey(selectedCaseId, authData.userId), value);
  };

  const participant = getParticipant(selectedCase, authData?.accountType);
  const caseTimeline = getCaseTimeline(selectedCase);
  const canAcceptCase = authData?.accountType === 'LAWYER'
    && selectedCase?.status === 'PENDING'
    && Number(selectedCase?.lawyer?.userId) === Number(authData.userId);

  const acceptSelectedCase = async () => {
    if (!canAcceptCase || acceptingCase.current) return;
    const caseId = selectedCase.caseId;
    acceptingCase.current = true;
    setAcceptingCaseId(caseId);
    try {
      const accepted = await caseService.acceptCase(caseId);
      // Preserve participant details: the acceptance response is a case entity,
      // while the workspace list uses DTOs with client and lawyer information.
      setCases(current => current.map(item => item.caseId === caseId
        ? { ...item, status: accepted.status || 'ACCEPTED' }
        : item));
      if (accepted.generatedDocumentPin) {
        setDocumentPinNotice({ caseId, pin: accepted.generatedDocumentPin });
      }
      toast.success('Case accepted. Document access is now available with the case PIN.');
    } catch (error) {
      toast.error(error.message || 'Failed to accept case. Please try again.');
    } finally {
      acceptingCase.current = false;
      setAcceptingCaseId(null);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-8 mx-auto max-w-7xl">
        <div className="flex items-center justify-center py-24 bg-white border border-gray-200 rounded-lg">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-600">Loading legal workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 mx-auto max-w-7xl lg:flex lg:h-[calc(100dvh-var(--workspace-offset,4rem))] lg:min-h-0 lg:flex-col">
      {documentPinNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-generated-pin-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 id="workspace-generated-pin-title" className="text-xl font-semibold">Case accepted — save your document PIN</h2>
            <p className="mt-3 text-sm text-gray-600">Case #{documentPinNotice.caseId}. This PIN is shown once. Save it securely and share it with your client. You will both need it to unlock Documents.</p>
            <p className="my-6 font-mono text-4xl tracking-widest">{documentPinNotice.pin}</p>
            <button autoFocus className="w-full rounded-lg bg-blue-600 p-3 text-white" onClick={() => setDocumentPinNotice(null)}>I saved the PIN</button>
          </div>
        </div>
      )}
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Legal Workspace</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a case, then open the tool you need.</p>
      </div>

      <div className={`grid flex-1 min-h-0 gap-4 ${caseSidebarCollapsed ? 'lg:grid-cols-[64px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)]'}`}>
        <WorkspaceCaseSidebar
          cases={cases}
          isLawyer={authData?.accountType === 'LAWYER'}
          activeTab={caseListTab}
          onTabChange={changeCaseListTab}
          selectedCaseId={selectedCaseId}
          onSelect={setSelectedCaseId}
          collapsed={caseSidebarCollapsed}
          onToggleCollapsed={() => setCaseSidebarCollapsed(value => !value)}
        />
        <section aria-label="Selected case workspace" className="flex flex-col min-w-0 min-h-0">
          {!selectedCase ? (
            <div className="p-10 text-center bg-white border border-gray-200 rounded-lg">
              <BriefcaseBusiness className="w-10 h-10 mx-auto text-gray-400" />
              <h2 className="mt-3 text-lg font-semibold text-gray-900">Select a case to begin</h2>
              <p className="mt-1 text-sm text-gray-500">Your workspace appears once a case is selected.</p>
            </div>
          ) : (
            <div key={selectedCase.caseId} className="flex flex-col min-h-0 lg:flex-1">
              <div className="sticky top-[var(--workspace-offset,4rem)] z-20 bg-white border border-gray-200 rounded-t-lg shadow-sm shrink-0 lg:static">
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-blue-600">Case #{selectedCase.caseId} · {selectedCase.caseType || 'General'}</p>
                    <h2 title={selectedCase.title} className="mt-1 text-lg font-bold text-gray-900 line-clamp-2">{selectedCase.title || 'Untitled case'}</h2>
                    <p className="mt-1 text-xs text-gray-500">{participant.label}: {participant.name || 'N/A'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClass(selectedCase.status)}`}>{selectedCase.status}</span>
                    {canAcceptCase && (
                      <button type="button" onClick={acceptSelectedCase} disabled={acceptingCaseId !== null}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                        {acceptingCaseId === selectedCase.caseId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {acceptingCaseId === selectedCase.caseId ? 'Accepting…' : 'Accept Case'}
                      </button>
                    )}
                  </div>
                </div>
                <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} documentCount={documentCounts[selectedCase.caseId] || 0} />
              </div>

              <div className="flex flex-col flex-1 min-h-0 border border-t-0 border-gray-200 rounded-b-lg bg-gray-50">
                <WorkspacePanel id="overview" activeTab={activeTab}>
                  <div className="p-5 bg-white">
                    <h3 className="text-base font-semibold text-gray-900">Case Overview</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 whitespace-pre-wrap break-words">{selectedCase.description || 'No description provided.'}</p>

                    <div className="grid gap-3 mt-5 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoTile icon={Calendar} label="Submitted" value={formatDate(selectedCase.dateSubmitted)} />
                      <InfoTile icon={BriefcaseBusiness} label="Type" value={selectedCase.caseType || 'General'} />
                      <InfoTile icon={UserRound} label={participant.label} value={participant.name} />
                      <InfoTile icon={FileText} label="Documents" value={`${documentCounts[selectedCase.caseId] || 0}`} />
                    </div>

                    <div className="pt-5 mt-5 border-t border-gray-100">
                      <div className="flex flex-col gap-1 mb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Case Timeline</h3>
                          <p className="text-sm text-gray-500">Track the main workspace milestones for this case.</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500">
                          Last updated {formatDateTime(selectedCase.updatedAt || selectedCase.dateSubmitted)}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {caseTimeline.map((item, index) => (
                          <TimelineStep
                            key={item.label}
                            item={item}
                            isLast={index === caseTimeline.length - 1}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </WorkspacePanel>

                <WorkspacePanel id="hearings" activeTab={activeTab}>
                  <CaseHearingCalendar caseInfo={selectedCase} authData={authData} />
                </WorkspacePanel>

                <WorkspacePanel id="documents" activeTab={activeTab}>
                  <div className="p-5 bg-white">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Case Documents</h3>
                    </div>
                    {selectedCase.status === 'ACCEPTED' ? (
                      <CaseDocumentManager caseId={selectedCase.caseId} caseInfo={selectedCase} userRole={authData.accountType}
                        authData={authData} onDocumentsChange={() => refreshDocumentCount(selectedCase.caseId)} />
                    ) : (
                      <p className="p-6 text-sm text-gray-600 border border-gray-200 rounded-md bg-gray-50">Document access opens once the case is accepted.</p>
                    )}
                  </div>
                </WorkspacePanel>

                <WorkspacePanel id="notes" activeTab={activeTab}>
                  <div className="flex min-h-[320px] flex-col p-5 bg-white lg:h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <NotebookPen className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Workspace Notes</h3>
                    </div>
                    <label htmlFor="workspace-notes" className="mb-3 text-sm text-gray-500">Keep your private next steps, questions, and reminders for this case.</label>
                    <textarea id="workspace-notes" value={notes} onChange={event => saveNotes(event.target.value)}
                      placeholder="Add your notes here…"
                      className="flex-1 min-h-[220px] w-full p-3 text-sm border border-gray-300 rounded-md resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-100 lg:resize-none" />
                    <p className="mt-3 text-xs text-gray-500">Saved automatically in this browser for this case.</p>
                  </div>
                </WorkspacePanel>

              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const WorkspacePanel = ({ id, activeTab, children }) => (
  <section id={`workspace-panel-${id}`} role="tabpanel" aria-labelledby={`workspace-tab-${id}`} hidden={activeTab !== id}
    tabIndex={0} className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-b-lg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500">
    {children}
  </section>
);

const InfoTile = (props) => {
  const { icon: Icon, label, value } = props;
  return (
    <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-900 truncate">{value || 'N/A'}</p>
    </div>
  );
};

const TimelineStep = ({ item, isLast }) => {
  const stateStyles = {
    done: {
      icon: CheckCircle2,
      iconClass: 'text-green-600 bg-green-50',
      lineClass: 'bg-green-200',
      badgeClass: 'bg-green-100 text-green-800',
      label: 'Done'
    },
    current: {
      icon: Clock3,
      iconClass: 'text-blue-600 bg-blue-50',
      lineClass: 'bg-blue-200',
      badgeClass: 'bg-blue-100 text-blue-800',
      label: 'Current'
    },
    upcoming: {
      icon: Circle,
      iconClass: 'text-gray-400 bg-gray-50',
      lineClass: 'bg-gray-200',
      badgeClass: 'bg-gray-100 text-gray-600',
      label: 'Upcoming'
    }
  };

  const style = stateStyles[item.state] || stateStyles.upcoming;
  const Icon = style.icon;

  return (
    <div className="relative p-3 border border-gray-200 rounded-lg bg-gray-50">
      {!isLast && (
        <div className={`hidden xl:block absolute top-7 left-[calc(100%-8px)] w-6 h-0.5 ${style.lineClass}`} />
      )}
      <div className="flex items-start gap-3">
        <span className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${style.iconClass}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${style.badgeClass}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{item.description}</p>
          {item.date && <p className="mt-2 text-xs font-medium text-gray-600">{item.date}</p>}
        </div>
      </div>
    </div>
  );
};

const sortCasesByRecency = caseItems => [...caseItems].sort((first, second) => {
  const firstTimestamp = Date.parse(first.updatedAt || first.dateSubmitted || '') || 0;
  const secondTimestamp = Date.parse(second.updatedAt || second.dateSubmitted || '') || 0;
  return secondTimestamp - firstTimestamp || Number(second.caseId || 0) - Number(first.caseId || 0);
});

const getNotesKey = (caseId, userId) => `ally.workspace.notes.${userId}.${caseId}`;

const getCaseTimeline = (caseItem) => {
  if (!caseItem) return [];

  const status = caseItem.status || 'PENDING';
  const submittedDate = formatDate(caseItem.dateSubmitted);
  const acceptedStatuses = ['ACCEPTED', 'COMPLETED'];
  const completedStatuses = ['COMPLETED'];
  const declinedStatuses = ['DECLINED', 'CANCELLED'];

  if (declinedStatuses.includes(status)) {
    return [
      {
        label: 'Submitted',
        description: 'Client submitted the legal case for review.',
        date: submittedDate,
        state: 'done'
      },
      {
        label: 'Reviewed',
        description: status === 'DECLINED'
          ? 'The case was reviewed and declined.'
          : 'The case was cancelled before active work started.',
        date: formatDate(caseItem.updatedAt),
        state: 'current'
      },
      {
        label: 'Workspace',
        description: 'Workspace activity is closed for this case.',
        state: 'upcoming'
      },
      {
        label: 'Archived',
        description: 'Final records remain available based on user permissions.',
        state: 'upcoming'
      }
    ];
  }

  return [
    {
      label: 'Submitted',
      description: 'Client submitted the case details and initial information.',
      date: submittedDate,
      state: 'done'
    },
    {
      label: 'Lawyer Review',
      description: acceptedStatuses.includes(status)
        ? 'A lawyer accepted the case and can work on it.'
        : 'Waiting for lawyer or admin review.',
      state: acceptedStatuses.includes(status) ? 'done' : 'current'
    },
    {
      label: 'Active Workspace',
      description: 'Documents, notes, AI assistance, and collaboration happen here.',
      state: completedStatuses.includes(status)
        ? 'done'
        : acceptedStatuses.includes(status)
          ? 'current'
          : 'upcoming'
    },
    {
      label: 'Closed or Archived',
      description: 'The case is finalized and retained as a read-only record.',
      state: completedStatuses.includes(status) ? 'current' : 'upcoming'
    }
  ];
};

const getParticipant = (caseItem, role) => {
  if (!caseItem) return { label: 'Participant', name: 'N/A' };

  if (role === 'LAWYER') {
    return {
      label: 'Client',
      name: caseItem.client ? `${caseItem.client.Fname || ''} ${caseItem.client.Lname || ''}`.trim() : 'N/A'
    };
  }

  return {
    label: 'Lawyer',
    name: caseItem.lawyer ? `${caseItem.lawyer.Fname || ''} ${caseItem.lawyer.Lname || ''}`.trim() : 'Awaiting assignment'
  };
};

const statusClass = (status) => {
  switch (status) {
    case 'ACCEPTED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'DECLINED':
      return 'bg-red-100 text-red-800';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default LegalWorkspacePage;
