import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";

const TITLES = new Set(["mr", "mrs", "ms", "fr", "father"]);
function firstName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const idx = TITLES.has(parts[0].toLowerCase()) ? 1 : 0;
  return parts[idx] || fullName;
}

const ICONS = {
  instructions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  topics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M8 7h8" />
    </svg>
  ),
  games: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15 20c.2-2.6 1.9-4.6 4-4.9" />
    </svg>
  ),
  bonuses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16M12 9v11" />
      <path d="M12 9c-1.8 0-3.2-1.2-3.2-2.7C8.8 4.9 10 4 11 4c1.3 0 2 1.4 2 2.6" />
      <path d="M12 9c1.8 0 3.2-1.2 3.2-2.7C15.2 4.9 14 4 13 4c-1.3 0-2 1.4-2 2.6" />
    </svg>
  ),
};

const EXPLORE_CONFIG = [
  { to: "/instructions", badge: "gold", icon: "instructions", titleKey: "home.linkInstructionsTitle" },
  { to: "/timeline", badge: "olive", icon: "timeline", titleKey: "home.linkTimelineTitle" },
  { to: "/topics", badge: "maroon", icon: "topics", titleKey: "home.linkTopicsTitle" },
  { to: "/games", badge: "olive-dark", icon: "games", titleKey: "home.linkGamesTitle" },
  { to: "/teams", badge: "gold", icon: "teams", titleKey: "home.linkTeamsTitle" },
  { to: "/bonuses", badge: "brick", icon: "bonuses", titleKey: "home.linkBonusesTitle", fullOnly: true },
];

export default function Home() {
  const { user, token } = useAuth();
  const { t, tDay } = useLanguage();
  const [upcomingDay, setUpcomingDay] = useState(null);
  const [previewTopics, setPreviewTopics] = useState([]);

  useEffect(() => {
    Promise.all([api.getTimeline(token), api.getTopics(token)])
      .then(([timelineData, topicsData]) => {
        setUpcomingDay(timelineData.timeline[0] || null);
        setPreviewTopics(topicsData.topics.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  const roleLabel = t(`roles.${user.role}`).toUpperCase();

  return (
    <div className="page">
      <div className="hero-banner">
        <div className="hero-photo-bg">
          <img src="/images/home/hero-bg.jpg" alt="" />
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            {t("home.heroWelcome")}, {roleLabel}
          </div>
          <h1 className="hero-title">
            {t("home.heroGreeting")} {firstName(user.name)}
          </h1>
          <p className="hero-subtitle">{t("home.heroSubtitle")}</p>
          <p className="hero-meta">{t("home.heroMeta")}</p>
          <div className="hero-ctas">
            <Link to="/timeline" className="hero-btn hero-btn--outline">
              {t("home.heroCtaTimeline")}
            </Link>
            {user.role === "full" ? (
              <Link to="/bonuses" className="hero-btn hero-btn--outline">
                {t("home.heroCtaBonuses")}
              </Link>
            ) : (
              <Link to="/teams" className="hero-btn hero-btn--outline">
                {t("home.heroCtaTeam")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="section-gap">
        <div className="eyebrow">{t("home.exploreEyebrow")}</div>
        <h2 className="explore-title">{t("home.exploreTitle")}</h2>
        <div className="explore-grid">
          {EXPLORE_CONFIG.filter((c) => !c.fullOnly || user.role === "full").map((c) => (
            <Link key={c.to} to={c.to} className="explore-card">
              <div className={`icon-badge icon-badge--${c.badge}`}>{ICONS[c.icon]}</div>
              <h3>{t(c.titleKey)}</h3>
              <span className="open-link">{t("home.openLink")}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-gap gallery-section">
        <div className="gallery-text-col">
          <h2 className="explore-title" style={{ marginBottom: 0 }}>
            {t("home.galleryTitle")}
          </h2>
          <p className="gallery-lead">{t("home.galleryLead")}</p>
          <p>{t("home.galleryText")}</p>
        </div>
        <div className="gallery-photos">
          <div className="gallery-photo">
            <img src="/images/home/gallery-1.jpg" alt="" />
          </div>
          <div className="gallery-photo">
            <img src="/images/home/gallery-2.jpg" alt="" />
          </div>
          <div className="gallery-photo">
            <img src="/images/home/gallery-3.jpg" alt="" />
          </div>
        </div>
      </div>

      <div className="section-gap preview-grid">
        <div className="card">
          <div className="eyebrow">{t("home.upNextEyebrow")}</div>
          {upcomingDay ? (
            <>
              <h3 className="preview-card-title">
                {t("timeline.day")} {upcomingDay.day} — {tDay(upcomingDay.label)}
              </h3>
              <div className="timeline-list" style={{ padding: 0 }}>
                {upcomingDay.sessions.slice(0, 4).map((s) => (
                  <div className="timeline-row" key={s.id}>
                    <span className="timeline-dot" />
                    <div className="timeline-card">
                      <span className="time-pill">{s.time}</span>
                      <span className="session-title">{s.title}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/timeline" className="preview-more-link">
                {t("home.seeFullTimeline")}
              </Link>
            </>
          ) : (
            <p className="empty-note">{t("home.noUpcoming")}</p>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">{t("home.topicsPreviewEyebrow")}</div>
          {previewTopics.length ? (
            <>
              {previewTopics.map((topic) => (
                <div className="topics-preview-item" key={topic.id}>
                  <h3>{topic.title}</h3>
                  <p>{topic.description}</p>
                </div>
              ))}
              <Link to="/topics" className="preview-more-link">
                {t("home.allTopics")}
              </Link>
            </>
          ) : (
            <p className="empty-note">{t("home.noTopicsYet")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
