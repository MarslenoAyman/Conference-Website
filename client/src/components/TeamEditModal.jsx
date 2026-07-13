import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const PALETTE = [
  "#5b6b4a",
  "#c9a06a",
  "#8c6f5e",
  "#3d4a2e",
  "#6b4a3a",
  "#a9b98c",
  "#b5433d",
  "#3a5a8c",
  "#a97a3a",
  "#7c9473",
];

export default function TeamEditModal({ team, teams, allUsers, onClose, onSaveDetails, onAssign, onUnassign }) {
  const { t } = useLanguage();
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [query, setQuery] = useState("");

  const teamNameById = useMemo(() => Object.fromEntries(teams.map((tm) => [tm.id, tm.name])), [teams]);
  const memberIds = useMemo(() => new Set(team.members.map((m) => m.id)), [team.members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers
      .filter((u) => !memberIds.has(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.phone.includes(q));
  }, [allUsers, memberIds, query]);

  function saveDetails() {
    if (!name.trim()) return;
    onSaveDetails({ name: name.trim(), color });
  }

  return (
    <Modal title={t("teams.editModalTitle")} onClose={onClose}>
      <div className="field">
        <label>{t("teams.teamName")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>{t("teams.teamColor")}</label>
        <div className="swatch-row">
          {PALETTE.map((c) => (
            <span
              key={c}
              className={"color-swatch" + (c === color ? " selected" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={saveDetails}>
        {t("common.save")}
      </button>

      <div className="modal-section-title">{t("teams.currentMembers")}</div>
      {team.members.length === 0 ? (
        <p className="empty-note">{t("teams.noMembers")}</p>
      ) : (
        team.members.map((m) => (
          <div className="member-pick-row" key={m.id}>
            <span className="member-pick-name">{m.name}</span>
            <button className="btn btn-sm btn-danger" onClick={() => onUnassign(m.id)}>
              {t("teams.removeFromTeam")}
            </button>
          </div>
        ))
      )}

      <div className="modal-section-title">{t("teams.allMembers")}</div>
      <input
        type="text"
        placeholder={t("teams.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 10,
        }}
      />
      {filtered.map((u) => (
        <div className="member-pick-row" key={u.id}>
          <div>
            <div className="member-pick-name">{u.name}</div>
            <div className="member-pick-status">
              {u.teamId ? `${t("teams.onOtherTeam")} ${teamNameById[u.teamId] || ""}` : t("teams.unassigned")}
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => onAssign(u.id)}>
            {u.teamId ? t("teams.moveHere") : t("teams.addHere")}
          </button>
        </div>
      ))}
    </Modal>
  );
}
