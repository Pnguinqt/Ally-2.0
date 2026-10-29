import React, { useState } from 'react';
import { Bot, Check, ChevronDown, Copy, ShieldCheck, Sparkles } from 'lucide-react';
import MarkdownText from '../shared/MarkdownText';

export const splitAnswerSummary = value => {
  const text = String(value || '').trim();
  const match = text.match(/^(?:\*\*)?QUICK[ _-]SUMMARY(?:\*\*)?\s*:\s*([^\r\n]+)(?:\r?\n|$)/i);

  if (!match) return { summary: '', answer: text };

  return {
    summary: match[1].trim(),
    answer: text.slice(match[0].length).trim() || text
  };
};

const AIAnswerCard = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const { summary, answer } = splitAnswerSummary(message.text);

  const copyAnswer = async () => {
    try {
      const copyText = summary ? `Quick summary: ${summary}\n\n${answer}` : answer;
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex w-full max-w-3xl items-start gap-3 sm:gap-4">
      <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm sm:flex">
        <Bot className="h-5 w-5" aria-hidden="true" />
      </div>

      <article className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white sm:hidden">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">ALLY legal assistant</p>
              <p className="text-[11px] font-medium text-slate-500">AI-supported legal information</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {message.timestamp && <time className="text-[11px] text-slate-400">{message.timestamp}</time>}
            <button
              type="button"
              onClick={() => setIsOpen(open => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Collapse answer' : 'Expand answer'}
              title={isOpen ? 'Collapse answer' : 'Expand answer'}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {isOpen && (
          <>
            <div className="px-4 py-5 sm:px-7 sm:py-6">
              {summary && (
                <section className="mx-auto max-w-[72ch] rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 sm:px-5">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Quick summary
                  </div>
                  <p className="text-sm font-medium leading-6 text-slate-800 sm:text-[15px]">{summary}</p>
                </section>
              )}
              <div className={summary ? 'mt-5' : ''}>
                <MarkdownText text={answer} variant="ai" />
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                Legal information, not legal advice
              </span>
              <button
                type="button"
                onClick={copyAnswer}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                aria-label={copied ? 'Answer copied' : 'Copy answer'}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy answer'}
              </button>
            </footer>
          </>
        )}
      </article>
    </div>
  );
};

export default AIAnswerCard;
