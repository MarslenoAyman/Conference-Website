import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import { GAME_ICONS, GAME_ICON_BADGE_CLASS, GAME_ICON_KEYS } from "../gameIcons.jsx";
import Alert from "../components/Alert.jsx";

const empty = { name: "", description: "", type: "roster", icon: "football", manager: "", singlesOnly: false, allServedView: false };

export default function Games() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(empty);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState(empty);

  const canEdit = user.role === "full";

  function load() {
    api.getGames(token).then((d) => setGames(d.games)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function createGame(e) {
    e.preventDefault();
    if (!addDraft.name.trim()) return;
    try {
      const { game } = await api.addGame(token, addDraft);
      setGames((prev) => [...prev, game]);
      setAddDraft(empty);
      setShowAdd(false);
    } catch (err) {
      setError(tError(err.message));
    }
  }

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

      {canEdit && !loading && (
        <div className="add-game-wrap">
          {showAdd ? (
            <form className="add-game-form card" onSubmit={createGame}>
              <div className="modal-section-title" style={{ marginTop: 0 }}>
                {t("games.newGameTitle")}
              </div>
              <div className="add-game-grid">
                <div className="field">
                  <label>{t("games.nameLabel")}</label>
                  <input
                    value={addDraft.name}
                    onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
                    placeholder={t("games.namePlaceholder")}
                  />
                </div>
                <div className="field">
                  <label>{t("games.managerLabel")}</label>
                  <input
                    value={addDraft.manager}
                    onChange={(e) => setAddDraft({ ...addDraft, manager: e.target.value })}
                    placeholder={t("games.managerPlaceholder")}
                  />
                </div>
                <div className="field">
                  <label>{t("games.systemLabel")}</label>
                  <select value={addDraft.type} onChange={(e) => setAddDraft({ ...addDraft, type: e.target.value })}>
                    <option value="roster">{t("games.typeRoster")}</option>
                    <option value="players">{t("games.typePlayers")}</option>
                    <option value="duel">{t("games.typeDuel")}</option>
                    <option value="matchup">{t("games.typeMatchup")}</option>
                    <option value="showcase">{t("games.typeShowcase")}</option>
                    <option value="station">{t("games.typeStation")}</option>
                    <option value="survival">{t("games.typeSurvival")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t("games.iconLabel")}</label>
                  <select value={addDraft.icon} onChange={(e) => setAddDraft({ ...addDraft, icon: e.target.value })}>
                    {GAME_ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`games.icon.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>{t("games.descriptionLabel")}</label>
                <textarea
                  rows={2}
                  value={addDraft.description}
                  onChange={(e) => setAddDraft({ ...addDraft, description: e.target.value })}
                />
              </div>
              {addDraft.type === "players" && (
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={addDraft.singlesOnly}
                    onChange={(e) => setAddDraft({ ...addDraft, singlesOnly: e.target.checked })}
                  />
                  {t("games.singlesOnlyLabel")}
                </label>
              )}
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={addDraft.allServedView}
                  onChange={(e) => setAddDraft({ ...addDraft, allServedView: e.target.checked })}
                />
                {t("games.allServedViewLabel")}
              </label>
              <div className="card-actions">
                <button className="btn btn-primary btn-sm" type="submit">
                  {t("games.createGame")}
                </button>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setAddDraft(empty);
                  }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              + {t("games.addGameButton")}
            </button>
          )}
        </div>
      )}

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
                      <option value="players">{t("games.typePlayers")}</option>
                      <option value="duel">{t("games.typeDuel")}</option>
                      <option value="matchup">{t("games.typeMatchup")}</option>
                      <option value="showcase">{t("games.typeShowcase")}</option>
                      <option value="station">{t("games.typeStation")}</option>
                      <option value="survival">{t("games.typeSurvival")}</option>
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
