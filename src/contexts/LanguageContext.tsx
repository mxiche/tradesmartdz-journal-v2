import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, getLanguage, setLanguage as setLang, initLanguage, t, TranslationKey } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getLanguage());

  useEffect(() => {
    initLanguage();
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLang(lang);
    setLanguageState(lang);
  }, []);

  const translate = useCallback((key: TranslationKey) => t(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t: translate, isRtl: language === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
