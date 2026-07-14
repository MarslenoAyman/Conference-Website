import { useTheme } from "../context/ThemeContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Settings() {
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLanguage, t } = useLanguage();

  return (
    <div className="page">
      <h1 className="page-title">{t("settings.title")}</h1>

      <div className="card settings-section">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("settings.darkMode")}</div>
            <div className="settings-row-desc">{t("settings.darkModeDesc")}</div>
          </div>
          <button
            className={"toggle-switch" + (isDark ? " on" : "")}
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            aria-label={t("settings.darkMode")}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("settings.language")}</div>
            <div className="settings-row-desc">{t("settings.languageDesc")}</div>
          </div>
          <div className="lang-toggle-group">
            <button
              className={"lang-toggle-btn" + (lang === "ar" ? " active" : "")}
              onClick={() => setLanguage("ar")}
            >
              {t("settings.arabic")}
            </button>
            <button
              className={"lang-toggle-btn" + (lang === "en" ? " active" : "")}
              onClick={() => setLanguage("en")}
            >
              {t("settings.english")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
