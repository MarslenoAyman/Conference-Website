import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getT, translateError, translateDayLabel } from "../i18n.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ar");

  useEffect(() => {
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);

  const setLanguage = useCallback((next) => setLang(next), []);
  const t = useMemo(() => getT(lang), [lang]);
  const tError = useCallback((message) => translateError(lang, message), [lang]);
  const tDay = useCallback((label) => translateDayLabel(lang, label), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, tError, tDay, isRtl: lang === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
