import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import TeamEditModal from "../components/TeamEditModal.jsx";
import Alert from "../components/Alert.jsx";

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

export default function Teams() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newManager, setNewManager] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const canManage = user.role === "full";

  function load() {
    api
      .getTeams(token)
      .then((d) => setTeams(d.teams))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    if (canManage) {
      api.getUsers(token).then((d) => setAllUsers(d.users)).catch(() => {});
    }
  }, [canManage]);

  async function addTeam(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { team } = await api.addTeam(token, newName, newColor, newManager);
      setTeams((prev) => [...prev, team]);
      setNewName("");
      setNewManager("");
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function deleteTeam(team) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteTeam(token, team.id);
      load();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function adjustPoints(team, delta) {
    try {
      const { team: updated } = await api.adjustTeamPoints(token, team.id, delta);
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, points: updated.points } : t)));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function saveTeamDetails(teamId, details) {
    try {
      await api.updateTeam(token, teamId, details);
      load();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function assignMember(teamId, userId) {
    try {
      await api.assignToTeam(token, teamId, userId);
      load();
      const { users } = await api.getUsers(token);
      setAllUsers(users);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function unassignMember(userId) {
    try {
      await api.unassign(token, userId);
      load();
      const { users } = await api.getUsers(token);
      setAllUsers(users);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  const editingTeam = teams.find((tm) => tm.id === editingTeamId) || null;

  return (
    <div className="page">
      <h1 className="page-title">
        {t("teams.titleStart")} {t("teams.titleEm") && <em>{t("teams.titleEm")}</em>}
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : teams.length === 0 ? (
        <p className="center-note">{user.role === "none" ? t("teams.notAssignedYet") : t("teams.noTeamsYet")}</p>
      ) : (
        <div className="grid-teams">
          {teams.map((team) => (
            <div className="team-card" key={team.id}>
              <div className="team-banner" style={{ background: team.color }}>
                <div className="team-banner-top">
                  <span>{t("teams.team")}</span>
                  <span>
                    {team.members.length} {t("teams.members")}
                  </span>
                </div>
                <div className="team-banner-bottom">
                  <h3>{team.name}</h3>
                  <span className="team-pts">
                    {team.points} {t("teams.pts")}
                  </span>
                </div>
              </div>
              <div className="team-body">
                {team.manager && (
                  <p className="team-manager">
                    {t("teams.responsible")}: <strong>{team.manager}</strong>
                  </p>
                )}
                {team.members.length === 0 ? (
                  <div className="empty-note">{t("teams.noMembers")}</div>
                ) : (
                  team.members.map((m) => (
                    <div className="member-row" key={m.id}>
                      <span>{m.name}</span>
                    </div>
                  ))
                )}

                {canManage && (
                  <>
                    <div className="points-adjust">
                      <button className="round-btn" onClick={() => adjustPoints(team, -1)}>
                        −
                      </button>
                      <span>{t("teams.points")}</span>
                      <button className="round-btn" onClick={() => adjustPoints(team, 1)}>
                        +
                      </button>
                    </div>
                    <div className="card-actions">
                      <button className="btn btn-sm" onClick={() => setEditingTeamId(team.id)}>
                        {t("teams.editTeam")}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteTeam(team)}>
                        {t("teams.deleteTeam")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form className="add-box" onSubmit={addTeam}>
          <label>{t("teams.createTeamLabel")}</label>
          <div className="add-row">
            <input placeholder={t("teams.teamNamePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input
              placeholder={t("teams.responsiblePlaceholder")}
              value={newManager}
              onChange={(e) => setNewManager(e.target.value)}
            />
            <div className="swatch-row">
              {PALETTE.map((c) => (
                <span
                  key={c}
                  className={"color-swatch" + (c === newColor ? " selected" : "")}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button className="btn btn-primary" type="submit">
              {t("teams.addTeamButton")}
            </button>
          </div>
        </form>
      )}

      {editingTeam && (
        <TeamEditModal
          team={editingTeam}
          teams={teams}
          allUsers={allUsers}
          onClose={() => setEditingTeamId(null)}
          onSaveDetails={(details) => saveTeamDetails(editingTeam.id, details)}
          onAssign={(userId) => assignMember(editingTeam.id, userId)}
          onUnassign={(userId) => unassignMember(userId)}
        />
      )}
    </div>
  );
}
