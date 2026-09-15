'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useGlobalStore } from '@/store/useGlobalStore';

type GoogleTranslateConstructor = new (options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean }, elementId: string) => unknown;
type GoogleWindow = Window & { google?: { translate?: { TranslateElement?: GoogleTranslateConstructor } }; googleTranslateElementInit?: () => void };

function triggerTranslation(language: 'ko' | 'en') {
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!select) return false;
  select.value = language === 'en' ? 'en' : '';
  select.dispatchEvent(new Event('change'));
  return true;
}

export default function GoogleTranslate() {
  const language = useGlobalStore((state) => state.language);
  const pathname = usePathname();
  const translatingRef = useRef(false);

  useEffect(() => {
    const googleWindow = window as GoogleWindow;
    const initialize = () => {
      const TranslateElement = googleWindow.google?.translate?.TranslateElement;
      if (!TranslateElement) return;
      const root = document.getElementById('google_translate_element');
      if (root && !root.dataset.ready) {
        new TranslateElement({ pageLanguage: 'ko', includedLanguages: 'en,ko', autoDisplay: false }, 'google_translate_element');
        root.dataset.ready = '1';
      }
      window.setTimeout(() => triggerTranslation(language), 100);
    };

    googleWindow.googleTranslateElementInit = initialize;
    if (!document.querySelector('script[data-google-translate]')) {
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.dataset.googleTranslate = '1';
      document.head.appendChild(script);
    } else {
      initialize();
    }
    return () => {
      if (googleWindow.googleTranslateElementInit === initialize) delete googleWindow.googleTranslateElementInit;
    };
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      translatingRef.current = true;
      triggerTranslation(language);
      window.setTimeout(() => { translatingRef.current = false; }, 1200);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [language, pathname]);

  useEffect(() => {
    const root = document.querySelector('.portal-frame');
    if (!root) return;
    let timer = 0;
    const observer = new MutationObserver((mutations) => {
      if (language !== 'en' || translatingRef.current) return;
      if (!mutations.some((mutation) => mutation.addedNodes.length > 0)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        translatingRef.current = true;
        triggerTranslation('en');
        window.setTimeout(() => { translatingRef.current = false; }, 1200);
      }, 500);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [language]);

  return <div id="google_translate_element" className="google-translate-root" aria-hidden="true" />;
}
