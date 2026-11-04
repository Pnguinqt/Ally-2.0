import React, { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher = ({ inNavigation = false }) => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const controlRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = event => {
      if (!controlRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  if (inNavigation) return (
    <div ref={controlRef} className="relative" data-no-translate
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
      }}>
      <button ref={buttonRef} type="button" aria-label="Change language" title="Change language" aria-expanded={open}
        aria-controls={open ? 'nav-language-options' : undefined} onClick={() => setOpen(value => !value)}
        className={`flex items-center justify-center w-10 h-10 rounded-full text-[#2B62C4] transition-colors ${open ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
        <Languages className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <div id="nav-language-options" role="group" aria-label="Language" className="absolute right-0 z-50 w-44 p-1 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg">
        <p className="px-3 py-2 text-xs font-semibold text-gray-500">Language</p>
        {[['en', 'English'], ['ceb', 'Bisaya']].map(([value, label]) => <button key={value} type="button" aria-pressed={language === value}
          onClick={() => { setLanguage(value); setOpen(false); buttonRef.current?.focus(); }}
          className="flex items-center justify-between w-full px-3 py-2 text-sm text-left text-gray-700 rounded-lg hover:bg-blue-50">
          {label}{language === value && <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg"
      data-no-translate
    >
      <Languages className="h-4 w-4 text-blue-600" aria-hidden="true" />
      <label htmlFor="ally-language" className="sr-only">
        {language === 'ceb' ? 'Pinulongan' : 'Language'}
      </label>
      <select
        id="ally-language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="cursor-pointer bg-transparent text-sm font-medium text-gray-700 outline-none"
        aria-label={language === 'ceb' ? 'Pilia ang pinulongan' : 'Choose language'}
      >
        <option value="en">English</option>
        <option value="ceb">Bisaya</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
