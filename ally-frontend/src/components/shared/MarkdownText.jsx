import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

const isSafeExternalUrl = (href) => /^https?:\/\//i.test(href || '');

const getMarkdownComponents = (variant) => {
  const isAI = variant === 'ai';
  const paragraphClass = isAI
    ? 'my-4 whitespace-pre-line text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8'
    : 'my-3 whitespace-pre-line leading-7';

  return {
  p: ({ children }) => <p className={paragraphClass}>{children}</p>,
  ul: ({ children }) => <ul className={`${isAI ? 'my-5 space-y-3 pl-6 marker:text-blue-600' : 'my-3 space-y-2 pl-5'} list-disc`}>{children}</ul>,
  ol: ({ children }) => <ol className={`${isAI ? 'my-5 space-y-3 pl-6 marker:font-semibold marker:text-blue-600' : 'my-3 space-y-2 pl-5'} list-decimal`}>{children}</ol>,
  li: ({ children }) => <li className={isAI ? 'pl-1 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8' : 'leading-7'}>{children}</li>,
  h1: ({ children }) => <h1 className={isAI ? 'mb-3 mt-7 border-l-4 border-blue-600 pl-3 text-xl font-bold leading-snug text-slate-950 sm:text-2xl' : 'mb-2 mt-4 text-xl font-semibold'}>{children}</h1>,
  h2: ({ children }) => <h2 className={isAI ? 'mb-3 mt-7 border-l-4 border-blue-600 pl-3 text-lg font-bold leading-snug text-slate-950 sm:text-xl' : 'mb-2 mt-4 text-lg font-semibold'}>{children}</h2>,
  h3: ({ children }) => <h3 className={isAI ? 'mb-2 mt-6 text-base font-bold leading-snug text-slate-900 sm:text-lg' : 'mb-2 mt-3 text-base font-semibold'}>{children}</h3>,
  strong: ({ children }) => <strong className={isAI ? 'font-bold text-slate-950' : 'font-semibold'}>{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className={isAI
      ? 'my-5 rounded-r-xl border-l-4 border-blue-500 bg-blue-50 px-4 py-2 text-slate-700 [&>p]:my-2'
      : 'my-3 border-l-4 border-current/30 pl-4 italic'}>
      {children}
    </blockquote>
  ),
  hr: () => <hr className={isAI ? 'my-7 border-slate-200' : 'my-4 border-black/20'} />,
  a: ({ href, children }) => {
    if (!isSafeExternalUrl(href)) {
      return <span>{children}</span>;
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={isAI
          ? 'font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900'
          : 'font-medium underline underline-offset-2'}
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className={`${isAI ? 'my-6 rounded-xl border border-slate-200' : 'my-3'} overflow-x-auto`}>
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className={isAI ? 'bg-slate-100 text-slate-900' : 'bg-black/10'}>{children}</thead>,
  th: ({ children }) => (
    <th className={isAI ? 'border-b border-slate-200 px-4 py-3 font-bold' : 'border-b-2 border-black/30 px-3 py-2 font-semibold'}>{children}</th>
  ),
  tr: ({ children }) => <tr className={isAI ? 'even:bg-slate-50' : 'even:bg-black/[0.03]'}>{children}</tr>,
  td: ({ children }) => <td className={isAI ? 'border-b border-slate-100 px-4 py-3 align-top leading-6 text-slate-700' : 'border-b border-black/20 px-3 py-2 align-top'}>{children}</td>,
  pre: ({ children }) => <pre className={isAI ? 'my-5 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-6 text-slate-100' : 'my-3 overflow-x-auto'}>{children}</pre>,
  code: ({ children }) => (
    <code className={isAI ? 'rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900' : 'rounded bg-black/10 px-1 py-0.5 font-mono text-[0.95em]'}>{children}</code>
  ),
  };
};

const MarkdownText = ({ text, className = '', variant = 'default' }) => {
  // Some model responses escape table delimiters as "\\|". Unescape those
  // delimiters so remark-gfm can recognize the table structure.
  const normalizedText = String(text || '').replace(/\\\|/g, '|');

  return (
    <div className={`${variant === 'ai' ? 'mx-auto max-w-[72ch] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0' : ''} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={getMarkdownComponents(variant)}>
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownText;
