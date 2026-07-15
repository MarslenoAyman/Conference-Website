import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { gameName } from "../i18n.js";
import { api } from "../api.js";
import { GAME_ICONS, GAME_ICON_BADGE_CLASS } from "../gameIcons.jsx";
import Alert from "../components/Alert.jsx";

// Fixed display order for the games catalogue. The grid fills left-to-right in
// the English theme and right-to-left in Arabic (dir=rtl), automatically.
const GAME_ORDER = [
  "rumble",
  "squid",
  "football",
  "volleyball",
  "pingpong",
  "billiard",
  "domino",
  "tawla",
  "chess",
  "playstation",
  "cards",
];
const orderIndex = (game) => {
  const i = GAME_ORDER.indexOf(game.nameKey);
  return i === -1 ? GAME_ORDER.length : i;
};

export default function Games() {
  const { token } = useAuth();
  const { t, tError } = useLanguage();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getGames(token)
      .then((d) => setGames([...d.games].sort((a, b) => orderIndex(a) - orderIndex(b))))
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <h1 className="page-title">
        {t("games.titleStart")} <em>{t("games.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="grid-2">
          {games.map((game) => (
            <Link className="game-card" to={`/games/${game.id}`} key={game.id}>
              <div className={"icon-badge " + (GAME_ICON_BADGE_CLASS[game.icon] || GAME_ICON_BADGE_CLASS.ball)}>
                {GAME_ICONS[game.icon] || GAME_ICONS.ball}
              </div>
              <h3>{gameName(game, t)}</h3>
              {game.manager && (
                <p className="game-manager">
                  {t("games.responsible")}: <strong>{game.manager}</strong>
                </p>
              )}
              <span className="open-link">{t("home.openLink")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
