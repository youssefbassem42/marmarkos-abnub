import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import i18n from "./index";
import {
  LANGUAGE_STORAGE_KEY,
  LanguageContext,
  type Language,
} from "./context";

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" || stored === "ar" ? stored : "ar";
}

function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    void i18n.changeLanguage(language);
    applyDocumentLanguage(language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
