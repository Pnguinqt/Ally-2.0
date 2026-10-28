import React from 'react';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';

export const SIMILARITY_NOTICE = 'Similarity does not establish legal applicability or mean that a decision controls your situation.';

function relevanceExplanation(value) {
  if (typeof value !== 'string') return '';
  // The shared composer notice now covers this boilerplate, including saved
  // responses from before the layout change. Preserve the actual explanation.
  return value.replace(/\s*Similarity does not establish legal applicability or mean that (?:a|this) decision controls your situation\.\s*$/, '').trim();
}

export const VALIDATION_WARNING = 'ALLY found potentially relevant case records, but the final Supreme Court disposition could not be verified from the currently indexed metadata. The retrieved text may include rulings from lower courts. Please review the official Supreme Court or E-Library decision before relying on the legal outcome.';
export const NO_RESULT_MESSAGE = 'No sufficiently relevant case was found in ALLY’s current verified collection. This does not mean that no applicable Supreme Court decision exists. Consider searching the official Supreme Court E-Library or consulting a qualified legal professional.';

function sourceLink(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['sc.judiciary.gov.ph', 'elibrary.judiciary.gov.ph'].includes(url.hostname)
      && !url.username && !url.password && !url.port && !value.split('/')[2]?.includes('@') ? url.href : null;
  } catch { return null; }
}

function readable(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Not available';
  const text = value.trim().replace(/_/g, ' ');
  return text[0].toUpperCase() + text.slice(1).toLowerCase();
}

function decisionDate(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Not available';
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return text;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function RetrievedCases({ message }) {
  // The parent renders message.text in the main chat bubble. Keep a fallback
  // notice for responses without that text, but never repeat the same notice.
  const normalizeNotice = value => typeof value === 'string'
    ? value.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim() : '';
  const alreadyShown = notice => normalizeNotice(message.text) === normalizeNotice(notice);
  if (message.confidence === 'Service unavailable') return alreadyShown('Case retrieval is unavailable. Please try again later.')
    ? null : <div role="alert" className="mt-3 rounded-2xl bg-red-50 p-4 text-sm">Case retrieval is unavailable. Please try again later.</div>;
  const cases = (message.relevantCases || []).filter(item => item.legal_validation_status === 'verified'
    && item.can_state_final_outcome === true && sourceLink(item.source_url)).slice(0, 3);
  if (!cases.length) return alreadyShown(NO_RESULT_MESSAGE)
    ? null : <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm">{NO_RESULT_MESSAGE}</div>;
  return <div className="mt-4 w-full space-y-4 text-sm [overflow-wrap:anywhere]">
    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 sm:px-5">
      <h4 className="flex items-center gap-2 font-semibold text-blue-950">
        <BookOpen className="h-4 w-4 text-blue-600" aria-hidden="true" />
        Verified case sources ({cases.length})
      </h4>
      <p className="mt-1.5 text-xs leading-5 text-blue-800">
        These sources may be relevant to your question. Open the official decision before relying on a legal outcome.
      </p>
    </div>
    {cases.map((item, index) => {
      const verified = item.legal_validation_status === 'verified' && item.can_state_final_outcome === true;
      const link = sourceLink(item.source_url);
      return <article key={index} className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="space-y-2">
          <h5 className="text-base font-bold leading-6 text-slate-950 sm:text-lg">{item.title || item.case_title || 'Untitled case record'}</h5>
          <p className="text-sm font-medium text-slate-600">{item.case_number || item.citation || 'Case number: Not available'}</p>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${verified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{verified ? 'Verified' : 'Unverified outcome'}</span>
        </header>
        {relevanceExplanation(item.relevance_explanation) && (
          <div className="rounded-xl border-l-4 border-blue-500 bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Why it may be relevant</p>
            <p className="text-sm leading-7 text-slate-700">{relevanceExplanation(item.relevance_explanation)}</p>
          </div>
        )}
        {!verified && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 leading-relaxed text-amber-950">{item.validation_warning || message.validation_warning || VALIDATION_WARNING}</p>}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Decision date</dt><dd className="mt-1 leading-6 text-slate-800">{decisionDate(item.decision_date)}</dd></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Court level</dt><dd className="mt-1 leading-6 text-slate-800">{readable(item.court_level)}</dd></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Similarity</dt><dd className="mt-1 leading-6 text-slate-800">{typeof item.score === 'number' && Number.isFinite(item.score) ? `${item.score.toFixed(1)}%` : 'Not available'}</dd></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Indexed section</dt><dd className="mt-1 leading-6 text-slate-800">{readable(item.section)}</dd></div>
          {verified && <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Final disposition</dt><dd className="mt-1 whitespace-pre-wrap font-medium leading-6 text-slate-800">{item.final_disposition || 'Not available'}</dd></div>}
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source provider</dt><dd className="mt-1 leading-6 text-slate-800">{item.source_provider || 'Not available'}</dd></div>
        </dl>
        {link && <a className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" href={link} target="_blank" rel="noopener noreferrer">View official source <ExternalLink className="h-4 w-4" /></a>}
        {item.content && <details className="group rounded-xl border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-700">
            Read retrieved case excerpt
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words border-t border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 sm:p-5">{item.content}</div>
        </details>}
      </article>;
    })}
  </div>;
}
