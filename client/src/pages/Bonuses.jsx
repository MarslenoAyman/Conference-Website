import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";

export default function Bonuses() {
  const { user, token } = useAuth();
  const { t, tError, lang } = useLanguage();
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});
  const [points, setPoints] = useState({});
  const [signs, setSigns] = useState({});

  const canEdit = user.role === "full";

  function load() {
    Promise.all([api.getBonusMembers(token), api.getBonusHistory(token)])
      .then(([membersRes, historyRes]) => {
        setMembers(membersRes.members);
        setHistory(historyRes.history);
      })
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function signFor(memberId) {
    return signs[memberId] || "plus";
  }

  async function confirm(member) {
    const amount = Number(points[member.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(tError("A numeric point change is required."));
      return;
    }
    const delta = signFor(member.id) === "minus" ? -amount : amount;
    try {
      const reason = (reasons[member.id] || "").trim() || undefined;
      const { member: updated } = await api.adjustBonus(token, member.id, delta, reason);
      setMembers((prev) =>
        prev
          .map((m) => (m.id === member.id ? { ...m, bonus: updated.bonus } : m))
          .sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name))
      );
      setPoints((prev) => ({ ...prev, [member.id]: "" }));
      setReasons((prev) => ({ ...prev, [member.id]: "" }));
      const { history: freshHistory } = await api.getBonusHistory(token);
      setHistory(freshHistory);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function removeMember(member) {
    if (!confirm(t("bonuses.deleteConfirm"))) return;
    try {
      await api.deleteBonusMember(token, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      const { history: freshHistory } = await api.getBonusHistory(token);
      setHistory(freshHistory);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="page">
      <div className="bonus-header">
        <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: 0 }}>
          {t("bonuses.title")} <em>{t("bonuses.titleEm")}</em>
        </h1>
      </div>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : members.length === 0 ? (
        <p className="center-note">{t("bonuses.noMembers")}</p>
      ) : (
        <div className="card section-gap">
          {members.map((m, idx) => (
            <div className="bonus-row" key={m.id}>
              <span className="bonus-rank">{idx + 1}</span>
              <div>
                <div className="bonus-name">{m.name}</div>
                <div className="bonus-team">{m.phone}</div>
              </div>
              {canEdit && (
                <input
                  className="bonus-reason-input"
                  type="text"
                  placeholder={t("bonuses.reasonPlaceholder")}
                  value={reasons[m.id] || ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
              )}
              <div className="bonus-controls">
                <span className="bonus-count">{m.bonus}</span>
                {canEdit && (
                  <>
                    <input
                      className="bonus-points-input"
                      type="text"
                      inputMode="numeric"
                      placeholder={t("bonuses.pointsPlaceholder")}
                      value={points[m.id] || ""}
                      onChange={(e) =>
                        setPoints((prev) => ({ ...prev, [m.id]: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                    />
                    <button
                      type="button"
                      className={"round-btn sign-btn" + (signFor(m.id) === "minus" ? " active" : "")}
                      onClick={() => setSigns((prev) => ({ ...prev, [m.id]: "minus" }))}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={"round-btn sign-btn" + (signFor(m.id) === "plus" ? " active" : "")}
                      onClick={() => setSigns((prev) => ({ ...prev, [m.id]: "plus" }))}
                    >
                      +
                    </button>
                    <button className="pill-btn" onClick={() => confirm(m)}>
                      {t("bonuses.confirm")}
                    </button>
                  </>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="bonus-delete-btn"
                    title={t("bonuses.deleteMember")}
                    aria-label={t("bonuses.deleteMember")}
                    onClick={() => removeMember(m)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="card section-gap">
          <div className="modal-section-title" style={{ margin: "0 0 10px" }}>
            {t("bonuses.historyTitle")}
          </div>
          {history.length === 0 ? (
            <p className="empty-note">{t("bonuses.noHistoryYet")}</p>
          ) : (
            history.map((h) => (
              <div className="bonus-history-row" key={h.id}>
                <div>
                  <span className="bonus-history-name">{h.userName}</span>
                  <span className={"bonus-history-delta" + (h.delta < 0 ? " negative" : "")}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                  {h.reason && <span className="bonus-history-reason">— {h.reason}</span>}
                  {h.actorName && (
                    <span className="bonus-history-actor">
                      {t("bonuses.byActor")} {h.actorName}
                    </span>
                  )}
                </div>
                <span className="bonus-history-date">{formatDate(h.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
