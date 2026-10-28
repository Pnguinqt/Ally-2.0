import React, { useState } from 'react';
import { Bot, Check, Copy, ShieldCheck } from 'lucide-react';
import MarkdownText from '../shared/MarkdownText';

const AIAnswerCard = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(String(message.text || ''));
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
          {message.timestamp && <time className="shrink-0 text-[11px] text-slate-400">{message.timestamp}</time>}
        </header>

        <div className="px-4 py-5 sm:px-7 sm:py-6">
          <MarkdownText text={message.text} variant="ai" />
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
      </article>
    </div>
  );
};

export default AIAnswerCard;
