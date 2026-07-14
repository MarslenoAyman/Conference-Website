import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import { GAME_ICONS, GAME_ICON_BADGE_CLASS, GAME_ICON_KEYS } from "../gameIcons.jsx";
import Alert from "../components/Alert.jsx";

const empty = { name: "", description: "", type: "roster", icon: "football", manager: "" };

export default function Games() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(empty);

  const canEdit = user.role === "full";

  function load() {
    api.getGames(token).then((d) => setGames(d.games)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function startEdit(game, e) {
    e.preventDefault();
    setEditingId(game.id);
    setEditDraft({ name: game.name, description: game.description, type: game.type, icon: game.icon, manager: game.manager || "" });
  }

  async function saveEdit(id) {
    try {
      const { game } = await api.updateGame(token, id, editDraft);
      setGames((prev) => prev.map((item) => (item.id === id ? game : item)));
      setEditingId(null);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function remove(id, e) {
    e.preventDefault();
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteGame(token, id);
      setGames((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(tError(err.message));
    }
  }

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
              {editingId === game.id ? (
                <div onClick={(e) => e.preventDefault()}>
                  <div className="add-row" style={{ marginBottom: 10 }}>
                    <input
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                      placeholder={t("games.namePlaceholder")}
                    />
                    <select value={editDraft.type} onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}>
                      <option value="roster">{t("games.typeRoster")}</option>
                      <option value="duel">{t("games.typeDuel")}</option>
                      <option value="matchup">{t("games.typeMatchup")}</option>
                    </select>
                    <select value={editDraft.icon} onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })}>
                      {GAME_ICON_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {t(`games.icon.${key}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                  <input
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8, marginTop: 8 }}
                    placeholder={t("games.managerPlaceholder")}
                    value={editDraft.manager}
                    onChange={(e) => setEditDraft({ ...editDraft, manager: e.target.value })}
                  />
                  <div className="card-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(game.id)}>
                      {t("common.save")}
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={"icon-badge " + (GAME_ICON_BADGE_CLASS[game.icon] || GAME_ICON_BADGE_CLASS.ball)}>
                    {GAME_ICONS[game.icon] || GAME_ICONS.ball}
                  </div>
                  <h3>{game.name}</h3>
                  {game.manager && (
                    <p className="game-manager">
                      {t("games.responsible")}: <strong>{game.manager}</strong>
                    </p>
                  )}
                  <span className="open-link">{t("home.openLink")}</span>
                  {canEdit && (
                    <div className="card-actions">
                      <button className="btn btn-sm" onClick={(e) => startEdit(game, e)}>
                        {t("common.edit")}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={(e) => remove(game.id, e)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
