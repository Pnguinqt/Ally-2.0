import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { caseNoteService } from '../services/caseNoteService.js';

export default function WorkspaceNotes({ caseId, auth, demo }) {
  const storageKey = `ally.workspace.notes.${auth.userId}.${caseId}`;
  const [draft, setDraft] = useState(() => {
    if (demo) return demo.getNotes();
    try { return localStorage.getItem(storageKey) || null; }
    catch { return null; }
  });
  const [saved, setSaved] = useState(undefined);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const content = draft ?? saved ?? '';
  const loading = !demo && saved === undefined && !loadError;
  const dirty = content !== (saved ?? '');

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    caseNoteService.load(caseId, auth.token, controller.signal).then(value => {
      if (!controller.signal.aborted) setSaved(value);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, [caseId, auth.token, demo, loadAttempt]);

  function changeDraft(value) {
    setDraft(value);
    setSaveError('');
    if (demo) {
      demo.saveNotes(value);
      return;
    }
    try {
      if (value === (saved ?? '')) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
    } catch {
      // The current draft can still be saved to the account.
    }
  }

  async function save(event) {
    event.preventDefault();
    if (demo || saved === undefined || !dirty || saving) return;
    setSaveError('');
    setSaving(true);
    try {
      setSaved(await caseNoteService.save(caseId, auth.token, content));
      try {
        if (localStorage.getItem(storageKey) === content) localStorage.removeItem(storageKey);
      } catch {
        // The account save succeeded even if browser storage is unavailable.
      }
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex min-h-[320px] flex-col bg-white p-5 lg:h-full">
      <div className="mb-3 flex items-center gap-2">
        <NotebookPen className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Workspace Notes</h3>
      </div>
      <label htmlFor="workspace-notes" className="mb-3 text-sm text-gray-500">Keep your private next steps, questions, and reminders for this case.</label>
      <textarea id="workspace-notes" value={content} onChange={event => changeDraft(event.target.value)}
        readOnly={loading || Boolean(loadError) || saving} placeholder="Add your notes here…"
        className="min-h-[220px] w-full flex-1 resize-y rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 lg:resize-none" />
      {demo ? (
        <p className="mt-3 text-xs text-gray-500">Saved automatically in this browser for this case.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {loadError ? (
            <button type="button" onClick={() => { setLoadError(''); setLoadAttempt(attempt => attempt + 1); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Try again</button>
          ) : (
            <button type="submit" disabled={loading || saving || !dirty}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving…' : 'Save note'}
            </button>
          )}
          <div className="text-sm">
            {loadError || saveError ? <p role="alert" className="text-red-700">{loadError || saveError}</p> : (
              <p role="status" className="text-gray-600">
                {loading ? 'Loading note…' : dirty ? 'Unsaved changes' : saved !== null ? 'Saved to your account' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
