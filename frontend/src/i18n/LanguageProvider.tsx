import { useEffect, useMemo, type ReactNode } from "react";

import i18n from "./index";
import { LanguageContext } from "./context";

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  useEffect(() => {
    void i18n.changeLanguage("ar");
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  const value = useMemo(() => ({ language: "ar" as const }), []);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
