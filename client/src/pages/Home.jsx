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

export default function Home() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getInstructions(token),
      api.getTimeline(token),
      api.getTopics(token),
      api.getGames(token),
      api.getTeams(token),
    ])
      .then(([instr, timeline, topics, games, teams]) => {
        setStats({
          days: timeline.timeline.length,
          topics: topics.topics.length,
          games: games.games.length,
          teams: teams.teams.length,
        });
      })
      .catch(() => {});
  }, []);

  const links = [
    { to: "/instructions", title: t("home.linkInstructionsTitle"), desc: t("home.linkInstructionsDesc") },
    { to: "/timeline", title: t("home.linkTimelineTitle"), desc: t("home.linkTimelineDesc") },
    { to: "/topics", title: t("home.linkTopicsTitle"), desc: t("home.linkTopicsDesc") },
    { to: "/games", title: t("home.linkGamesTitle"), desc: t("home.linkGamesDesc") },
    { to: "/teams", title: t("home.linkTeamsTitle"), desc: t("home.linkTeamsDesc") },
  ];
  if (user.role === "full") {
    links.push({ to: "/bonuses", title: t("home.linkBonusesTitle"), desc: t("home.linkBonusesDesc") });
  }

  return (
    <div className="page">
      <div className="home-hero">
        <div className="eyebrow">{t("home.eyebrow")}</div>
        <h1 className="page-title">
          {t("home.welcome")} <em>{firstName(user.name)}</em>
        </h1>
        <p className="page-subtitle">{t("home.subtitle")}</p>
      </div>

      {stats && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">{t("home.days")}</div>
            <div className="stat-value">{stats.days}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("home.topics")}</div>
            <div className="stat-value">{stats.topics}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("home.games")}</div>
            <div className="stat-value">{stats.games}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("home.teams")}</div>
            <div className="stat-value">{stats.teams}</div>
          </div>
        </div>
      )}

      <div className="section-gap">
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>{t("home.whereNext")}</h2>
        <div className="quick-links">
          {links.map((l) => (
            <Link key={l.to} className="quick-link" to={l.to}>
              <h3>{l.title}</h3>
              <p>{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
