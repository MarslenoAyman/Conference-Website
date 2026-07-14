import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";

export default function Bonuses() {
  const { token } = useAuth();
  const { t, tError } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});

  function load() {
    api.getBonusMembers(token).then((d) => setMembers(d.members)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function adjust(member, delta) {
    try {
      const reason = (reasons[member.id] || "").trim() || undefined;
      const { member: updated } = await api.adjustBonus(token, member.id, delta, reason);
      setMembers((prev) =>
        prev
          .map((m) => (m.id === member.id ? { ...m, bonus: updated.bonus } : m))
          .sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name))
      );
    } catch (err) {
      setError(tError(err.message));
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
          {members.map((m) => (
            <div className="bonus-row" key={m.id}>
              <div>
                <div className="bonus-name">{m.name}</div>
                <div className="bonus-team">{m.phone}</div>
              </div>
              <input
                className="bonus-reason-input"
                type="text"
                placeholder={t("bonuses.reasonPlaceholder")}
                value={reasons[m.id] || ""}
                onChange={(e) => setReasons((prev) => ({ ...prev, [m.id]: e.target.value }))}
              />
              <div className="bonus-controls">
                <button className="round-btn" onClick={() => adjust(m, -1)}>
                  −
                </button>
                <span className="bonus-count">{m.bonus}</span>
                <button className="round-btn plus" onClick={() => adjust(m, 1)}>
                  +
                </button>
                <button className="pill-btn" onClick={() => adjust(m, 5)}>
                  +5
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
