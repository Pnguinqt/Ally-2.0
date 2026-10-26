import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { translateText } from '../i18n/translations';

const STORAGE_KEY = 'ally-language';
const SUPPORTED_LANGUAGES = ['en', 'ceb'];
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const LanguageContext = createContext(null);

const readLanguage = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en';
};

const shouldSkip = (node) => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return !element || Boolean(element.closest('script, style, code, pre, [data-no-translate], [contenteditable="true"]'));
};

const LocalizedContent = ({ language }) => {
  const textRecords = useRef(new WeakMap());
  const attributeRecords = useRef(new WeakMap());

  useEffect(() => {
    const translateNode = (textNode) => {
      if (textNode.nodeType !== Node.TEXT_NODE || shouldSkip(textNode)) return;

      const current = textNode.nodeValue;
      const record = textRecords.current.get(textNode);
      const source = record && current === record.rendered ? record.source : current;
      const rendered = translateText(source, language);

      textRecords.current.set(textNode, { source, rendered });
      if (current !== rendered) textNode.nodeValue = rendered;
    };

    const translateAttributes = (element) => {
      if (element.nodeType !== Node.ELEMENT_NODE || shouldSkip(element)) return;

      let records = attributeRecords.current.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.current.set(element, records);
      }

      TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute);
        const record = records.get(attribute);
        const source = record && current === record.rendered ? record.source : current;
        const rendered = translateText(source, language);
        records.set(attribute, { source, rendered });
        if (current !== rendered) element.setAttribute(attribute, rendered);
      });
    };

    const translateTree = (root) => {
      if (!root || shouldSkip(root)) return;
      if (root.nodeType === Node.TEXT_NODE) {
        translateNode(root);
        return;
      }

      translateAttributes(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateNode(node);
        else translateAttributes(node);
        node = walker.nextNode();
      }
    };

    translateTree(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') translateNode(mutation.target);
        mutation.addedNodes.forEach(translateTree);
      });
    });

    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
};

export const LanguageProvider = ({ children }) => {
  const [language, updateLanguage] = useState(readLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    const safeLanguage = SUPPORTED_LANGUAGES.includes(nextLanguage) ? nextLanguage : 'en';
    localStorage.setItem(STORAGE_KEY, safeLanguage);
    updateLanguage(safeLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'ceb' ? 'ceb' : 'en';
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (text) => translateText(text, language),
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      <LocalizedContent language={language} />
    </LanguageContext.Provider>
  );
};

// The provider and its hook intentionally share this module so they use one context instance.
// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
