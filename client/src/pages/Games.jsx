import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";

const empty = { name: "", when: "", description: "" };
const TAG_COLORS = ["var(--olive)", "var(--gold)", "var(--maroon)", "var(--olive-dark)"];
const ICONS = ["🎲", "🧩", "🔥", "🎯", "🏆", "⛺"];

export default function Games() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(empty);

  const canEdit = user.role === "full";

  function load() {
    api.getGames(token).then((d) => setGames(d.games)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addGame(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      const { game } = await api.addGame(token, draft);
      setGames((prev) => [...prev, game]);
      setDraft(empty);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function startEdit(game) {
    setEditingId(game.id);
    setEditDraft({ name: game.name, when: game.when, description: game.description });
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

  async function remove(id) {
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
      <div className="eyebrow">{t("games.eyebrow")}</div>
      <h1 className="page-title">
        {t("games.titleStart")} <em>{t("games.titleEm")}</em>
      </h1>
      <p className="page-subtitle">{t("games.subtitle")}</p>

      {error && <div className="auth-error" style={{ marginTop: 20 }}>{error}</div>}

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="grid-2">
          {games.map((game, idx) => (
            <div className="game-card" key={game.id}>
              {editingId === game.id ? (
                <>
                  <div className="add-row" style={{ marginBottom: 10 }}>
                    <input
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                      placeholder={t("games.namePlaceholder")}
                    />
                    <input
                      value={editDraft.when}
                      onChange={(e) => setEditDraft({ ...editDraft, when: e.target.value })}
                      placeholder={t("games.whenPlaceholder")}
                    />
                  </div>
                  <textarea
                    rows={2}
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                  <div className="card-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(game.id)}>
                      {t("common.save")}
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="game-top">
                    <div className="game-icon">{ICONS[idx % ICONS.length]}</div>
                    {game.when && (
                      <span className="when-tag" style={{ background: TAG_COLORS[idx % TAG_COLORS.length] }}>
                        {game.when}
                      </span>
                    )}
                  </div>
                  <h3>{game.name}</h3>
                  <p>{game.description}</p>
                  {canEdit && (
                    <div className="card-actions">
                      <button className="btn btn-sm" onClick={() => startEdit(game)}>
                        {t("common.edit")}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(game.id)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form className="add-box" onSubmit={addGame}>
          <label>{t("games.addLabel")}</label>
          <div className="add-row">
            <input
              placeholder={t("games.namePlaceholder")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              placeholder={t("games.whenPlaceholder")}
              value={draft.when}
              onChange={(e) => setDraft({ ...draft, when: e.target.value })}
            />
          </div>
          <div className="add-row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={t("games.descriptionPlaceholder")}
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }}>
            {t("games.addButton")}
          </button>
        </form>
      )}
    </div>
  );
}
