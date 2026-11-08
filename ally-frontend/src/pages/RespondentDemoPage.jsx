import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import LegalWorkspacePage from './LegalWorkspacePage';
import DocumentsPage from './DocumentsPage';
import { LawyerDirectoryPage } from './LawyerDirectoryPage';
import AppointmentsPage from './AppointmentsPage';
import AccountSettings from '../components/AccountSettings';
import { SidebarProvider } from '../contexts/SidebarContext';
import { DemoContext } from '../demo/DemoContext';
import { createDemoRuntime } from '../demo/demoRuntime';
import { DEMO_KEY, demoReducer, quests, questUnlocked, readDemoSession } from '../demo/demoState';
import { deleteDemoFile } from '../demo/demoService';
import QuestHints from '../demo/QuestHints';
import QuestQuestion from '../demo/QuestQuestion';
import QuestWindow from '../demo/QuestWindow';
import RespondentIntro from '../demo/RespondentIntro';

const requiredQuests = quests.filter(quest => !quest.optional);
const optionalQuests = quests.filter(quest => quest.optional);

function DemoChatRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('assistant', 'open');
  return <Navigate to={`/demo/workspace?${params.toString()}`} replace />;
}

function DemoMyCasesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/demo/workspace${search}`} replace />;
}

export default function RespondentDemoPage() {
  const [state, setState] = useState(readDemoSession);
  const stateRef = useRef(state);
  const questProgress = useRef(null);
  const dispatch = useCallback(action => {
    const next = demoReducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
  }, []);
  const [runtime] = useState(() => createDemoRuntime(() => stateRef.current, dispatch));
  const [showQuests, setShowQuests] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const requiredDone = requiredQuests.filter(quest => state.completed.includes(quest.id)).length;
  const optionalDone = optionalQuests.filter(quest => state.completed.includes(quest.id)).length;
  const nextQuest = requiredQuests.find(quest => !state.completed.includes(quest.id) && questUnlocked(state, quest.id));
  const pendingQuestion = requiredQuests.find(quest => state.pendingQuestions.includes(quest.id))
    || optionalQuests.find(quest => state.pendingQuestions.includes(quest.id));
  const complete = requiredDone === requiredQuests.length;

  useEffect(() => {
    try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(state)); }
    catch { setError('This browser cannot save demo progress. Keep this tab open during the evaluation.'); }
  }, [state]);

  useEffect(() => {
    const closeQuestsOnSmallScreen = () => {
      if (window.matchMedia('(max-width: 1023px)').matches) setShowQuests(false);
    };
    window.addEventListener('ai-chat-opened', closeQuestsOnSmallScreen);
    return () => window.removeEventListener('ai-chat-opened', closeQuestsOnSmallScreen);
  }, []);

  useEffect(() => {
    if (showQuests && window.matchMedia('(max-width: 1023px)').matches) {
      window.dispatchEvent(new Event('close-ai-chat'));
    }
  }, [showQuests]);

  const goToQuest = quest => {
    if (quest.id !== 'chat' && quest.id !== 'case-search') {
      window.dispatchEvent(new Event('close-ai-chat'));
      if (window.matchMedia('(max-width: 1023px)').matches) setShowQuests(false);
    }
    navigate(state.completed.includes(quest.id) && quest.revisitPath ? quest.revisitPath : quest.path);
  };
  const reset = async () => {
    if (state.busy) return;
    try {
      await deleteDemoFile(state.id);
      dispatch({ type: 'reset' });
      setConfirmReset(false); setShowQuests(false); setError(''); navigate('/demo', { replace: true });
    } catch (error) { setError(error.message); }
  };

  if (!state.started) return <RespondentIntro onStart={() => {
    dispatch({ type: 'start' });
    navigate('/demo/chat?mode=normal', { replace: true });
  }} />;

  return <DemoContext.Provider value={runtime}>
    <SidebarProvider key={state.id} persist={false}>
      <PageLayout>
        <div data-no-translate className="flex h-12 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 text-xs text-blue-900 sm:px-6">
          <div className="flex min-w-0 items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /><strong className="whitespace-nowrap font-semibold">Respondent demo</strong>
            <span className="hidden truncate text-blue-700 lg:inline">Practice account · Case and lawyer activity are simulated · AI is live</span></div>
          <Link to="/" className="shrink-0 text-blue-700 hover:underline">Exit demo</Link>
        </div>
        {error && <p role="alert" className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <Routes>
          <Route index element={<Navigate to="chat?mode=normal" replace />} />
          <Route path="chat" element={<DemoChatRedirect />} />
          <Route path="my-cases" element={<DemoMyCasesRedirect />} />
          <Route path="workspace" element={<LegalWorkspacePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:caseId" element={<DocumentsPage />} />
          <Route path="lawyers" element={<LawyerDirectoryPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="settings/*" element={<AccountSettings />} />
          <Route path="cases/new" element={<Navigate to="/demo/workspace?new=1" replace />} />
          <Route path="workspace/:tab" element={<Navigate to="/demo/workspace" replace />} />
          <Route path="*" element={<Navigate to="/demo/chat" replace />} />
        </Routes>
      </PageLayout>

      <button type="button" onClick={() => setShowQuests(open => !open)}
        aria-label={showQuests ? 'Close quest window' : 'Open quest window'} aria-describedby="demo-quest-status"
        aria-expanded={showQuests} aria-controls="demo-quest-window"
        className="fixed bottom-4 left-4 z-[55] inline-flex max-w-[calc(100vw-11rem)] items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-2.5 py-3 text-xs font-semibold text-blue-800 shadow-lg hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:gap-2 sm:px-3 sm:text-sm" data-no-translate>
        <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span id="demo-quest-status" aria-live="polite" className="whitespace-nowrap">
          {pendingQuestion ? `${state.pendingQuestions.length} to answer` : `Quests ${requiredDone}/${requiredQuests.length}`}
        </span>
        <progress value={requiredDone} max={requiredQuests.length} aria-label="Required quest completion" className="hidden h-1.5 w-24 accent-blue-600 sm:block" />
        {showQuests ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
      </button>

      <QuestWindow open={showQuests} onClose={() => setShowQuests(false)}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4" data-no-translate>
          <div>
            <p ref={questProgress} role="status" tabIndex={-1} className="mb-2 text-sm font-semibold text-gray-800">{requiredDone} of {requiredQuests.length} required · {optionalDone} of {optionalQuests.length} optional complete</p>
            <progress value={requiredDone} max={requiredQuests.length} aria-label="Required demo quest progress" className="h-2 w-full accent-blue-600" />
            {pendingQuestion && <button type="button" onClick={() => document.getElementById(`quest-question-${pendingQuestion.id}`)?.focus()}
              className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-blue-700">
              Answer question: {pendingQuestion.title}<ArrowRight className="h-4 w-4 shrink-0" />
            </button>}
            {nextQuest && !state.pendingQuestions.includes(nextQuest.id) && <button type="button" onClick={() => goToQuest(nextQuest)} className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-blue-700">
              Next: {nextQuest.title}<ArrowRight className="h-4 w-4 shrink-0" />
            </button>}
          </div>
          {complete && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900"><h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Ready for your survey</h3><p className="mt-2 text-sm leading-6">You’ve completed the required quests. Return to the survey provided by the research team.</p></div>}
          {quests.map((quest, index) => {
            const done = state.completed.includes(quest.id);
            const awaitingAnswer = state.pendingQuestions.includes(quest.id);
            const unlocked = done || questUnlocked(state, index);
            return <article key={quest.id} className={`flex gap-3 rounded-lg border p-3 ${done ? 'border-green-200 bg-green-50' : unlocked ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{done ? <Check className="h-4 w-4" /> : unlocked ? index + 1 : <LockKeyhole className="h-3.5 w-3.5" />}</span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-gray-900">{quest.title}</h3>{quest.optional && <span className="text-xs font-medium text-gray-600">Optional</span>}<p className="mt-2 text-xs leading-6 text-gray-600">{quest.detail}</p>
                {awaitingAnswer
                  ? <QuestQuestion quest={quest} onAnswer={answer => {
                    dispatch({ type: 'answer-question', questId: quest.id, answer });
                    questProgress.current?.focus();
                  }} />
                  : <button disabled={!unlocked} onClick={() => goToQuest(quest)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400">{done ? 'Revisit' : quest.action}<ArrowRight className="h-4 w-4" /></button>}
                {state.answers[quest.id] && <p className="mt-2 text-xs text-gray-600">Your answer: {state.answers[quest.id]}</p>}
                <QuestHints quest={quest} revealed={state.hints?.[quest.id]} onReveal={() => dispatch({ type: 'reveal-hint', questId: quest.id })} />
              </div>
            </article>;
          })}
          <div className="border-t border-gray-200 pt-5">
            {!confirmReset ? <button disabled={Boolean(state.busy)} onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-2 text-sm text-gray-600 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Reset for next respondent</button>
              : <div><p className="mb-3 text-sm text-gray-700">Clear this demo’s activity, quest answers, and uploaded PDF?</p><div className="flex gap-4"><button disabled={Boolean(state.busy)} onClick={reset} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">Clear demo</button><button onClick={() => setConfirmReset(false)} className="text-sm text-gray-600">Cancel</button></div></div>}
          </div>
        </div>
      </QuestWindow>
    </SidebarProvider>
  </DemoContext.Provider>;
}
