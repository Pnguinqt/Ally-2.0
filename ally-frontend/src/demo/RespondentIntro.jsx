import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ClipboardList, FileText, FolderOpen, KeyRound,
  MessageCircle, Scale, Search, ShieldCheck, Users,
} from 'lucide-react';

const slides = [
  {
    label: 'About ALLY',
    title: 'What is ALLY?',
    description: 'ALLY is a digital legal engagement platform designed to help clients find lawyers, organize their cases, and explore Philippine legal information.',
    items: [
      { icon: Users, title: 'Find a lawyer', detail: 'Browse verified lawyer profiles and request an appointment.' },
      { icon: FolderOpen, title: 'Manage a case', detail: 'Keep case details, appointments, notes, and documents in one workspace.' },
      { icon: MessageCircle, title: 'Ask ALLY', detail: 'Use the AI assistant to explore legal questions, find court decisions, and summarize documents.' },
    ],
  },
  {
    label: 'Demo activities',
    title: 'What will you try?',
    description: 'You’ll explore ALLY from a client’s point of view using a practice account. No signup is needed.',
    items: [
      { icon: Search, title: 'Ask a question and try Case Search', detail: 'With Case Search off, ask a general Philippine legal question. Turn it on to look for Philippine Supreme Court decisions about a civil dispute.' },
      { icon: Scale, title: 'Create a practice civil case', detail: 'Choose a lawyer from the directory, explore the case overview and appointment calendar, and add a note.' },
      { icon: FileText, title: 'Work with the sample PDF', detail: 'Unlock Documents with the code shown on screen. Upload the supplied PDF, summarize it, and compare the summary with the original.' },
    ],
  },
  {
    label: 'Getting started',
    title: 'How does the demo work?',
    description: 'Start in Ask ALLY with Case Search off. For directions, open Quests at the bottom left.',
    items: [
      { icon: ClipboardList, title: 'Follow the quests', detail: 'Find tasks, hints, and short questions in Quests. Finish the required tasks before returning to the research team’s survey.' },
      { icon: KeyRound, title: 'Use fictional case details', detail: 'Case activity and document codes are simulated. AI chat, writing suggestions, and PDF summaries run live.' },
      { icon: ShieldCheck, title: 'Keep this tab open', detail: 'Progress and answers stay in this tab. On shared devices, select Reset for next respondent in Quests when you’re done.' },
    ],
  },
];

export default function RespondentIntro({ onStart }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const headingRef = useRef(null);
  const slide = slides[slideIndex];
  const isLastSlide = slideIndex === slides.length - 1;

  useEffect(() => {
    headingRef.current?.focus();
  }, [slideIndex]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-900" data-no-translate>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <img src="/ally_logo.svg" alt="ALLY" width="114" height="40" />
        <Link to="/" className="rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:text-blue-700 hover:underline">Exit demo</Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 sm:px-8 sm:pt-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:grid md:grid-cols-[15rem_1fr] lg:grid-cols-[18rem_1fr]">
          <aside className="bg-gradient-to-br from-[#0d2142] to-[#173b70] px-5 py-4 text-white sm:px-8 md:px-6 md:py-10 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Respondent demo</p>
            <ol aria-label="Introduction slides" className="mt-8 hidden space-y-2 md:block">
              {slides.map(({ label }, index) => (
                <li key={label} aria-current={index === slideIndex ? 'step' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${index === slideIndex ? 'bg-white/15 font-semibold text-white' : 'text-blue-100'}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 text-xs">{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </aside>

          <section aria-labelledby="respondent-intro-title" className="flex flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <p id="respondent-intro-step" className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700">Slide {slideIndex + 1} of {slides.length}</p>
            <h1 id="respondent-intro-title" ref={headingRef} tabIndex={-1} aria-describedby="respondent-intro-step"
              className="text-3xl font-semibold tracking-tight focus:outline-none sm:text-4xl">{slide.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{slide.description}</p>

            <ul className="mt-5 flex-1 divide-y divide-slate-100">
              {slide.items.map(item => (
                <li key={item.title} className="flex gap-3 py-3.5 sm:gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 sm:h-10 sm:w-10">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold leading-6 sm:text-base">{item.title}</h2>
                    <p className="text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5">
              {slideIndex > 0 && <button type="button" onClick={() => setSlideIndex(slideIndex - 1)}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:gap-1.5 sm:px-2.5 sm:text-sm">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>}
              <button type="button" onClick={isLastSlide ? onStart : () => setSlideIndex(slideIndex + 1)}
                className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-4 sm:text-sm">
                {isLastSlide ? 'Enter demo account' : 'Next'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
