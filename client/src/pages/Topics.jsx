import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";

const empty = { title: "", speaker: "", description: "" };

export default function Topics() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(empty);

  const canEdit = user.role === "full";

  function load() {
    api.getTopics(token).then((d) => setTopics(d.topics)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addTopic(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    try {
      const { topic } = await api.addTopic(token, draft);
      setTopics((prev) => [...prev, topic]);
      setDraft(empty);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function startEdit(topic) {
    setEditingId(topic.id);
    setEditDraft({ title: topic.title, speaker: topic.speaker, description: topic.description });
  }

  async function saveEdit(id) {
    try {
      const { topic } = await api.updateTopic(token, id, editDraft);
      setTopics((prev) => prev.map((item) => (item.id === id ? topic : item)));
      setEditingId(null);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function remove(id) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteTopic(token, id);
      setTopics((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">
        {t("topics.titleStart")} <em>{t("topics.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="grid-2">
          {topics.map((topic) => (
            <div className="topic-card" key={topic.id}>
              <span className="quote-mark">"</span>
              {editingId === topic.id ? (
                <>
                  <div className="add-row" style={{ marginBottom: 10 }}>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      placeholder={t("topics.titlePlaceholder")}
                    />
                    <input
                      value={editDraft.speaker}
                      onChange={(e) => setEditDraft({ ...editDraft, speaker: e.target.value })}
                      placeholder={t("topics.speakerPlaceholder")}
                    />
                  </div>
                  <textarea
                    rows={3}
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                  <div className="card-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(topic.id)}>
                      {t("common.save")}
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="speaker-tag">
                    <span className="speaker-dash" />
                    {t("topics.speaker")} · {topic.speaker}
                  </div>
                  <h3>{topic.title}</h3>
                  <p>{topic.description}</p>
                  {canEdit && (
                    <div className="card-actions">
                      <button className="btn btn-sm" onClick={() => startEdit(topic)}>
                        {t("common.edit")}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(topic.id)}>
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
        <form className="add-box" onSubmit={addTopic}>
          <label>{t("topics.addLabel")}</label>
          <div className="add-row">
            <input
              placeholder={t("topics.titlePlaceholder")}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <input
              placeholder={t("topics.speakerPlaceholder")}
              value={draft.speaker}
              onChange={(e) => setDraft({ ...draft, speaker: e.target.value })}
            />
          </div>
          <div className="add-row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={t("topics.descriptionPlaceholder")}
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }}>
            {t("topics.addButton")}
          </button>
        </form>
      )}
    </div>
  );
}
