import { useState } from 'react';
import { Check, ChevronDown, Copy, Lightbulb } from 'lucide-react';

export default function QuestHints({ quest, revealed = 0, onReveal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const count = Math.max(0, Math.min(Number.isInteger(revealed) ? revealed : 0, quest.hints.length));
  const panelId = `quest-hints-${quest.id}`;

  const toggleHints = () => {
    if (!isOpen && count === 0) onReveal();
    setIsOpen(open => !open);
  };

  const copyExample = async (example, index) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(index);
      setCopyStatus('Example copied. Paste it into the relevant field.');
    } catch {
      setCopied(null);
      setCopyStatus('Please select and copy the example text manually.');
    }
  };

  return <div className="mt-3">
    <button type="button" onClick={toggleHints} aria-expanded={isOpen} aria-controls={panelId}
      aria-label={`${isOpen ? 'Hide' : 'Show'} hints for ${quest.title}`}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
      <Lightbulb className="h-4 w-4" aria-hidden="true" />
      {isOpen ? 'Hide hints' : count ? `Hints (${count}/${quest.hints.length})` : 'Hint'}
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    <section id={panelId} hidden={!isOpen} aria-label={`Hints for ${quest.title}`} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs leading-5 text-amber-900">Optional guidance. Reveal another hint whenever you need more help.</p>
      <ol className="mt-3 space-y-4">
        {quest.hints.slice(0, count).map((hint, index) => <li key={hint.title}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Hint {index + 1} of {quest.hints.length}</p>
          <h4 className="mt-1 text-xs font-semibold text-gray-900">{hint.title}</h4>
          <p className="mt-1 text-xs leading-6 text-gray-700">{hint.text}</p>
          {hint.example && <div className="mt-2 rounded-md border border-amber-200 bg-white p-3">
            <p className="whitespace-pre-wrap break-words text-xs leading-6 text-gray-700">{hint.example}</p>
            <button type="button" onClick={() => copyExample(hint.example, index)} aria-label={`Copy example for ${quest.title}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
              {copied === index ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied === index ? 'Copied' : 'Copy example'}
            </button>
          </div>}
        </li>)}
      </ol>
      <p role="status" className="mt-2 text-xs leading-5 text-amber-900">{copyStatus}</p>
      {count < quest.hints.length
        ? <button type="button" onClick={onReveal} aria-label={`Show next hint for ${quest.title}`}
          className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Next hint ({count + 1}/{quest.hints.length})</button>
        : <p className="mt-3 text-xs font-medium text-amber-800">All hints shown. You can hide them and return whenever you need.</p>}
    </section>
  </div>;
}
