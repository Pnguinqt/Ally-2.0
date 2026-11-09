import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { suggestCaseDraft } from '../services/caseDraftService.js';
import { useDemoRuntime } from '../demo/DemoContext';

export default function CaseDraftAssistant({ formData, caseType, disabled, onApply }) {
  const demo = useDemoRuntime();
  const [facts, setFacts] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = async () => {
    if (loading || disabled) return;
    setError('');
    if (`${formData.title} ${formData.description} ${facts}`.trim().length < 20) {
      setError('Add a brief account of what happened in your notes or case description (at least 20 characters).'); return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setSuggestion(null);
    try {
      const result = await suggestCaseDraft({ ...formData, facts, caseType }, { demo: Boolean(demo), signal: controller.signal });
      if (!controller.signal.aborted) setSuggestion(result);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Unable to reach ALLY. Please try again.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };

  return <section aria-labelledby="case-draft-assistant-title" className="p-4 border border-blue-100 rounded-xl bg-blue-50/60">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-blue-600" aria-hidden="true" />
      <h4 id="case-draft-assistant-title" className="text-sm font-semibold text-gray-900">AI writing assistant</h4>
    </div>
    <p className="mt-2 text-xs leading-5 text-gray-600">Describe what happened in your own words. ALLY uses these notes and your current case details to suggest a clear title and description.</p>
    <label htmlFor="case-draft-facts" className="block mt-3 text-sm font-medium text-gray-700">Additional notes (optional)</label>
    <textarea id="case-draft-facts" rows={3} maxLength={3000} value={facts} onChange={event => setFacts(event.target.value)} disabled={disabled || loading}
      placeholder="What happened? Who was involved? Include dates, amounts, and the help you need, if known."
      className="w-full p-3 mt-1 text-sm bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" />
    <div className="flex flex-wrap items-center gap-3 mt-3">
      <button type="button" disabled={disabled || loading} onClick={generate}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Preparing suggestions…' : suggestion ? 'Try another draft' : 'Suggest title & description'}
      </button>
      {loading && <button type="button" onClick={() => { controllerRef.current?.abort(); setLoading(false); }} className="text-sm text-gray-600 hover:underline">Cancel generation</button>}
    </div>
    {loading && <p role="status" className="mt-2 text-xs text-gray-500">ALLY is organizing your facts. Your case fields stay editable.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {suggestion && <div aria-live="polite" className="p-4 mt-4 space-y-4 bg-white border border-blue-100 rounded-lg">
      <p className="text-xs text-gray-500">Review the suggestions for accuracy before applying them. You can edit the case fields afterward.</p>
      <div>
        <p className="text-xs font-semibold text-gray-500">Suggested title</p>
        <p className="mt-1 text-sm font-medium text-gray-900 break-words">{suggestion.title}</p>
        <button type="button" disabled={disabled} onClick={() => onApply({ title: suggestion.title })} className="mt-2 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">Use title</button>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500">Suggested description</p>
        <p className="mt-1 text-sm leading-6 text-gray-700 whitespace-pre-wrap break-words">{suggestion.description}</p>
        <button type="button" disabled={disabled} onClick={() => onApply({ description: suggestion.description })} className="mt-2 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">Use description</button>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={disabled} onClick={() => onApply(suggestion)} className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Use both</button>
        <button type="button" disabled={disabled} onClick={() => setSuggestion(null)} className="text-sm text-gray-600 hover:underline">Dismiss</button>
      </div>
    </div>}
  </section>;
}
