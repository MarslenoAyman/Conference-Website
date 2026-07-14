import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";

export default function Timeline() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDayLabel, setNewDayLabel] = useState("");
  const [sessionDrafts, setSessionDrafts] = useState({});

  const canEdit = user.role === "full";

  function load() {
    api.getTimeline(token).then((d) => setDays(d.timeline)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function draftFor(dayId) {
    return sessionDrafts[dayId] || { time: "", title: "" };
  }
  function setDraft(dayId, patch) {
    setSessionDrafts((prev) => ({ ...prev, [dayId]: { ...draftFor(dayId), ...patch } }));
  }

  async function addDay(e) {
    e.preventDefault();
    if (!newDayLabel.trim()) return;
    try {
      const { day } = await api.addDay(token, newDayLabel);
      setDays((prev) => [...prev, day]);
      setNewDayLabel("");
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function renameDay(day) {
    const label = prompt(t("timeline.renamePrompt"), day.label);
    if (!label || !label.trim()) return;
    try {
      const { day: updated } = await api.renameDay(token, day.id, label);
      setDays((prev) => prev.map((d) => (d.id === day.id ? updated : d)));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function deleteDay(day) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteDay(token, day.id);
      setDays((prev) => prev.filter((d) => d.id !== day.id));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function addSession(day) {
    const draft = draftFor(day.id);
    if (!draft.time.trim() || !draft.title.trim()) return;
    try {
      const { session } = await api.addSession(token, day.id, draft.time, draft.title);
      setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, sessions: [...d.sessions, session] } : d)));
      setDraft(day.id, { time: "", title: "" });
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function deleteSession(day, session) {
    try {
      await api.deleteSession(token, day.id, session.id);
      setDays((prev) =>
        prev.map((d) => (d.id === day.id ? { ...d, sessions: d.sessions.filter((s) => s.id !== session.id) } : d))
      );
    } catch (err) {
      setError(tError(err.message));
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">
        {t("timeline.titleStart")} <em>{t("timeline.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="section-gap">
          {days.map((day) => (
            <div className="day-block" key={day.id}>
              <div className="day-header">
                <h3>
                  {t("timeline.day")} {day.day} — {day.label}
                </h3>
                <div className="day-meta">
                  <span>
                    {day.sessions.length} {t("timeline.sessions")}
                  </span>
                  {canEdit && (
                    <>
                      <button className="btn btn-sm" onClick={() => renameDay(day)}>
                        {t("timeline.rename")}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteDay(day)}>
                        {t("timeline.deleteDay")}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="timeline-list">
                {day.sessions.map((s) => (
                  <div className="timeline-row" key={s.id}>
                    <span className="timeline-dot" />
                    <div className="timeline-card">
                      <span className="time-pill">{s.time}</span>
                      <span className="session-title">{s.title}</span>
                      {canEdit && (
                        <button className="btn btn-sm btn-danger" onClick={() => deleteSession(day, s)}>
                          {t("timeline.remove")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {canEdit && (
                  <div className="timeline-row">
                    <span className="timeline-dot" style={{ opacity: 0.3 }} />
                    <div className="timeline-card" style={{ background: "transparent", border: "1.5px dashed #b9ac8f" }}>
                      <input
                        placeholder={t("timeline.timePlaceholder")}
                        style={{ maxWidth: 100, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}
                        value={draftFor(day.id).time}
                        onChange={(e) => setDraft(day.id, { time: e.target.value })}
                      />
                      <input
                        placeholder={t("timeline.sessionPlaceholder")}
                        style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}
                        value={draftFor(day.id).title}
                        onChange={(e) => setDraft(day.id, { title: e.target.value })}
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => addSession(day)}>
                        {t("timeline.addSession")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {canEdit && (
            <form className="add-box" onSubmit={addDay}>
              <label>{t("timeline.addDayLabel")}</label>
              <div className="add-row">
                <input
                  type="text"
                  placeholder={t("timeline.addDayPlaceholder")}
                  value={newDayLabel}
                  onChange={(e) => setNewDayLabel(e.target.value)}
                />
                <button className="btn btn-primary" type="submit">
                  {t("timeline.addDayButton")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
