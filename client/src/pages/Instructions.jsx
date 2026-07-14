import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";

const CIRCLE_COLORS = ["var(--olive)", "var(--gold)", "var(--maroon)", "var(--olive-dark)"];

export default function Instructions() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");

  const canEdit = user.role === "full" || user.role === "limited";

  function load() {
    api.getInstructions(token).then((d) => setItems(d.instructions)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addInstruction(e) {
    e.preventDefault();
    if (!newText.trim()) return;
    try {
      const { instruction } = await api.addInstruction(token, newText);
      setItems((prev) => [...prev, instruction]);
      setNewText("");
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  async function saveEdit(id) {
    try {
      const { instruction } = await api.updateInstruction(token, id, editText);
      setItems((prev) => prev.map((i) => (i.id === id ? instruction : i)));
      setEditingId(null);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function remove(id) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteInstruction(token, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">
        {t("instructions.titleStart")} <em>{t("instructions.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="grid-2">
          {items.map((item, idx) => (
            <div className="card instruction-card" key={item.id}>
              <div className="instruction-num" style={{ background: CIRCLE_COLORS[idx % CIRCLE_COLORS.length] }}>
                {String(idx + 1).padStart(2, "0")}
              </div>
              <div style={{ flex: 1 }}>
                {editingId === item.id ? (
                  <>
                    <textarea
                      className="instruction-text"
                      style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="card-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => saveEdit(item.id)}>
                        {t("common.save")}
                      </button>
                      <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="instruction-text">{item.text}</div>
                    {canEdit && (
                      <div className="card-actions">
                        <button className="btn btn-sm" onClick={() => startEdit(item)}>
                          {t("common.edit")}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(item.id)}>
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form className="add-box" onSubmit={addInstruction}>
          <label>{t("instructions.addLabel")}</label>
          <div className="add-row">
            <input
              type="text"
              placeholder={t("instructions.addPlaceholder")}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              {t("instructions.addButton")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
