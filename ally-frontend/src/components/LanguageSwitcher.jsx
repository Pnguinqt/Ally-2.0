import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

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
