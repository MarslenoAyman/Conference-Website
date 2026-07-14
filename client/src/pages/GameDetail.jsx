import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import { GAME_ICONS, GAME_ICON_COLORS } from "../gameIcons.jsx";
import Modal from "../components/Modal.jsx";
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

export default function GameDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [game, setGame] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manageTeamId, setManageTeamId] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(PALETTE[0]);

  const canEdit = user.role === "full";

  function load() {
    setLoading(true);
    const calls = [api.getGame(token, id)];
    if (canEdit) calls.push(api.getUsers(token));
    Promise.all(calls)
      .then(([g, usersRes]) => {
        setGame(g.game);
        if (usersRes) setAllUsers(usersRes.users || []);
      })
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function assignRoster(teamId, userId) {
    try {
      const { rosters } = await api.addToRoster(token, id, teamId, userId);
      setGame((prev) => ({ ...prev, rosters }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function removeRoster(userId) {
    try {
      const { rosters } = await api.removeFromRoster(token, id, userId);
      setGame((prev) => ({ ...prev, rosters }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function addGameTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const { rosters } = await api.addGameTeam(token, id, newTeamName, newTeamColor);
      setGame((prev) => ({ ...prev, rosters }));
      setNewTeamName("");
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function saveTeamDetails(teamId, details) {
    try {
      const { rosters } = await api.updateGameTeam(token, id, teamId, details);
      setGame((prev) => ({ ...prev, rosters }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function deleteGameTeam(teamId) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      const { rosters } = await api.deleteGameTeam(token, id, teamId);
      setGame((prev) => ({ ...prev, rosters }));
      setManageTeamId((prev) => (prev === teamId ? null : prev));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function changeFormat(format) {
    try {
      await api.updateGame(token, id, { format });
      const { game: fresh } = await api.getGame(token, id);
      setGame(fresh);
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function changeTeamSize(teamSize) {
    try {
      await api.updateGame(token, id, { teamSize });
      const { game: fresh } = await api.getGame(token, id);
      setGame(fresh);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function createMatch(round, players) {
    const result = await api.addMatch(token, id, round, players);
    setGame((prev) => ({ ...prev, matches: result.matches, standings: result.standings }));
  }
  async function setMatchWinner(matchId, winnerSide) {
    try {
      const result = await api.setMatchWinner(token, id, matchId, winnerSide);
      setGame((prev) => ({ ...prev, matches: result.matches, standings: result.standings }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function deleteMatch(matchId) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      const result = await api.deleteMatch(token, id, matchId);
      setGame((prev) => ({ ...prev, matches: result.matches, standings: result.standings }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="center-note">{t("common.loading")}</p>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="page">
        <p className="center-note">{t("gameDetail.notFound")}</p>
      </div>
    );
  }

  const manageTeam = manageTeamId ? game.rosters.find((r) => r.teamId === manageTeamId) : null;

  return (
    <div className="page">
      <Link to="/games" className="preview-more-link" style={{ display: "inline-block", marginBottom: 16 }}>
        {t("gameDetail.backToGames")}
      </Link>
      <div className="game-detail-header">
        <div className="game-icon" style={{ color: GAME_ICON_COLORS[game.icon] || GAME_ICON_COLORS.ball }}>
          {GAME_ICONS[game.icon] || GAME_ICONS.ball}
        </div>
        <div>
          <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: 4 }}>
            {game.name}
          </h1>
          {game.description && (
            <p className="page-subtitle" style={{ margin: 0 }}>
              {game.description}
            </p>
          )}
        </div>
      </div>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {game.type === "roster" ? (
        <>
          <div className="grid-teams section-gap">
            {game.rosters.length === 0 ? (
              <p className="center-note">{t("gameDetail.noTeamsYet")}</p>
            ) : (
              game.rosters.map((r) => (
                <div className="team-card" key={r.teamId}>
                  <div className="team-banner" style={{ background: r.color }}>
                    <div className="team-banner-top">
                      <span>{t("gameDetail.roster")}</span>
                      <span>
                        {r.players.length} {t("teams.members")}
                      </span>
                    </div>
                    <div className="team-banner-bottom">
                      <h3>{r.teamName}</h3>
                    </div>
                  </div>
                  <div className="team-body">
                    {r.players.length === 0 ? (
                      <p className="empty-note">{t("gameDetail.noPlayersYet")}</p>
                    ) : (
                      r.players.map((p) => (
                        <div className="member-row" key={p.id}>
                          <span>{p.name}</span>
                        </div>
                      ))
                    )}
                    {canEdit && (
                      <div className="card-actions">
                        <button className="btn btn-sm" onClick={() => setManageTeamId(r.teamId)}>
                          {t("teams.editTeam")}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteGameTeam(r.teamId)}>
                          {t("teams.deleteTeam")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {canEdit && (
            <form className="add-box" onSubmit={addGameTeam}>
              <label>{t("teams.createTeamLabel")}</label>
              <div className="add-row">
                <input
                  placeholder={t("teams.teamNamePlaceholder")}
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
                <div className="swatch-row">
                  {PALETTE.map((c) => (
                    <span
                      key={c}
                      className={"color-swatch" + (c === newTeamColor ? " selected" : "")}
                      style={{ background: c }}
                      onClick={() => setNewTeamColor(c)}
                    />
                  ))}
                </div>
                <button className="btn btn-primary" type="submit">
                  {t("teams.addTeamButton")}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className="section-gap">
          {canEdit && (
            <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <div className="format-toggle">
                <button className={game.format === "league" ? "active" : ""} onClick={() => changeFormat("league")}>
                  {t("gameDetail.league")}
                </button>
                <button className={game.format === "cup" ? "active" : ""} onClick={() => changeFormat("cup")}>
                  {t("gameDetail.cup")}
                </button>
              </div>
              {game.type === "matchup" && (
                <div className="format-toggle">
                  <button className={game.teamSize === 1 ? "active" : ""} onClick={() => changeTeamSize(1)}>
                    {t("gameDetail.singles")}
                  </button>
                  <button className={game.teamSize === 2 ? "active" : ""} onClick={() => changeTeamSize(2)}>
                    {t("gameDetail.doubles")}
                  </button>
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setShowMatchModal(true)}>
                {t("gameDetail.newMatch")}
              </button>
            </div>
          )}

          {game.format === "cup" ? (
            <BracketView matches={game.matches} canEdit={canEdit} onSetWinner={setMatchWinner} onDelete={deleteMatch} t={t} />
          ) : (
            <div>
              {game.matches.length === 0 ? (
                <p className="empty-note">{t("gameDetail.noMatchesYet")}</p>
              ) : (
                game.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    canEdit={canEdit}
                    onSetWinner={(side) => setMatchWinner(m.id, side)}
                    onDelete={() => deleteMatch(m.id)}
                    t={t}
                  />
                ))
              )}
            </div>
          )}

          {game.standings && (
            <div className="card" style={{ marginTop: 24 }}>
              <div className="modal-section-title" style={{ margin: "0 0 10px" }}>
                {t("gameDetail.standings")}
              </div>
              {game.standings.length === 0 ? (
                <p className="empty-note">{t("gameDetail.noMatchesYet")}</p>
              ) : (
                game.standings.map((s, i) => (
                  <div className="standings-row" key={s.id}>
                    <span className="standings-rank">#{i + 1}</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span>
                      {s.wins}
                      {t("gameDetail.winsAbbr")} - {s.losses}
                      {t("gameDetail.lossesAbbr")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {manageTeam && (
        <GameTeamModal
          team={manageTeam}
          rosters={game.rosters}
          allUsers={allUsers}
          onSaveDetails={(details) => saveTeamDetails(manageTeam.teamId, details)}
          onAssign={(userId) => assignRoster(manageTeam.teamId, userId)}
          onRemove={removeRoster}
          onClose={() => setManageTeamId(null)}
        />
      )}

      {showMatchModal && (
        <MatchModal
          teamSize={game.teamSize}
          format={game.format}
          allUsers={allUsers}
          onCreated={createMatch}
          onClose={() => setShowMatchModal(false)}
        />
      )}
    </div>
  );
}

function GameTeamModal({ team, rosters, allUsers, onClose, onSaveDetails, onAssign, onRemove }) {
  const { t } = useLanguage();
  const [name, setName] = useState(team.teamName);
  const [color, setColor] = useState(team.color);
  const [query, setQuery] = useState("");

  const rosterTeamByUserId = useMemo(() => {
    const map = {};
    for (const r of rosters) {
      if (r.teamId === team.teamId) continue;
      for (const p of r.players) map[p.id] = r.teamName;
    }
    return map;
  }, [rosters, team.teamId]);
  const memberIds = useMemo(() => new Set(team.players.map((p) => p.id)), [team.players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers.filter((u) => !memberIds.has(u.id)).filter((u) => !q || u.name.toLowerCase().includes(q));
  }, [allUsers, memberIds, query]);

  function saveDetails() {
    if (!name.trim()) return;
    onSaveDetails({ name: name.trim(), color });
  }

  return (
    <Modal title={`${t("teams.editModalTitle")} — ${team.teamName}`} onClose={onClose}>
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

      <div className="modal-section-title">{t("gameDetail.onRoster")}</div>
      {team.players.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noPlayersYet")}</p>
      ) : (
        team.players.map((p) => (
          <div className="member-pick-row" key={p.id}>
            <span className="member-pick-name">{p.name}</span>
            <button className="btn btn-sm btn-danger" onClick={() => onRemove(p.id)}>
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
              {rosterTeamByUserId[u.id] ? `${t("teams.onOtherTeam")} ${rosterTeamByUserId[u.id]}` : t("teams.unassigned")}
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => onAssign(u.id)}>
            {rosterTeamByUserId[u.id] ? t("teams.moveHere") : t("teams.addHere")}
          </button>
        </div>
      ))}
    </Modal>
  );
}

function MatchModal({ teamSize, format, allUsers, onCreated, onClose }) {
  const { t, tError } = useLanguage();
  const [round, setRound] = useState(1);
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [pickingSide, setPickingSide] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const slotsPerSide = teamSize === 2 ? 2 : 1;
  const chosenIds = new Set([...sideA, ...sideB].filter(Boolean));
  const q = query.trim().toLowerCase();
  const candidates = allUsers.filter((u) => !chosenIds.has(u.id) && (!q || u.name.toLowerCase().includes(q)));
  const nameById = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

  function pick(userId) {
    if (!pickingSide) return;
    if (pickingSide.side === "a") {
      const next = [...sideA];
      next[pickingSide.slot] = userId;
      setSideA(next);
    } else {
      const next = [...sideB];
      next[pickingSide.slot] = userId;
      setSideB(next);
    }
    setPickingSide(null);
    setQuery("");
  }

  async function create() {
    const players = [
      ...sideA.filter(Boolean).map((userId) => ({ userId, side: "a" })),
      ...sideB.filter(Boolean).map((userId) => ({ userId, side: "b" })),
    ];
    if (!players.some((p) => p.side === "a") || !players.some((p) => p.side === "b")) {
      setError(t("gameDetail.pickBothSides"));
      return;
    }
    try {
      await onCreated(round, players);
      onClose();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  return (
    <Modal title={t("gameDetail.newMatch")} onClose={onClose}>
      <Alert message={error} onDismiss={() => setError("")} />
      {format === "cup" && (
        <div className="field">
          <label>{t("gameDetail.round")}</label>
          <input
            type="number"
            min="1"
            value={round}
            onChange={(e) => setRound(Number(e.target.value) || 1)}
            style={{ width: 80 }}
          />
        </div>
      )}
      {pickingSide ? (
        <>
          <div className="modal-section-title">{t("gameDetail.pickPlayer")}</div>
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
          {candidates.map((u) => (
            <div className="member-pick-row" key={u.id}>
              <span className="member-pick-name">{u.name}</span>
              <button className="btn btn-sm btn-primary" onClick={() => pick(u.id)}>
                {t("gameDetail.select")}
              </button>
            </div>
          ))}
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setPickingSide(null)}>
            {t("common.cancel")}
          </button>
        </>
      ) : (
        <>
          <div className="chair-picker">
            <div style={{ flex: 1 }}>
              {Array.from({ length: slotsPerSide }).map((_, i) => (
                <div
                  key={i}
                  className={"chair-slot" + (sideA[i] ? " filled" : "")}
                  style={{ marginBottom: i < slotsPerSide - 1 ? 8 : 0 }}
                  onClick={() => setPickingSide({ side: "a", slot: i })}
                >
                  {sideA[i] ? nameById[sideA[i]] : t("gameDetail.chooseSideA")}
                </div>
              ))}
            </div>
            <span className="chair-vs">{t("gameDetail.vs")}</span>
            <div style={{ flex: 1 }}>
              {Array.from({ length: slotsPerSide }).map((_, i) => (
                <div
                  key={i}
                  className={"chair-slot" + (sideB[i] ? " filled" : "")}
                  style={{ marginBottom: i < slotsPerSide - 1 ? 8 : 0 }}
                  onClick={() => setPickingSide({ side: "b", slot: i })}
                >
                  {sideB[i] ? nameById[sideB[i]] : t("gameDetail.chooseSideB")}
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={create}>
            {t("gameDetail.createMatch")}
          </button>
        </>
      )}
    </Modal>
  );
}

function MatchCard({ match, canEdit, onSetWinner, onDelete, t }) {
  const nameList = (side) => side.map((p) => p.name).join(" & ") || "—";
  return (
    <div className={"match-card" + (match.status === "done" ? " done" : "")}>
      <div className="match-sides">
        <div className={"match-side" + (match.winnerSide === "a" ? " winner" : "")}>{nameList(match.sideA)}</div>
        <span className="match-vs">{t("gameDetail.vs")}</span>
        <div className={"match-side" + (match.winnerSide === "b" ? " winner" : "")}>{nameList(match.sideB)}</div>
      </div>
      {canEdit && (
        <div className="card-actions" style={{ marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => onSetWinner("a")}>
            {t("gameDetail.sideAWins")}
          </button>
          <button className="btn btn-sm" onClick={() => onSetWinner("b")}>
            {t("gameDetail.sideBWins")}
          </button>
          {match.status === "done" && (
            <button className="btn btn-sm" onClick={() => onSetWinner(null)}>
              {t("gameDetail.resetMatch")}
            </button>
          )}
          <button className="btn btn-sm btn-danger" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}

function BracketView({ matches, canEdit, onSetWinner, onDelete, t }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  if (rounds.length === 0) return <p className="empty-note">{t("gameDetail.noMatchesYet")}</p>;
  return (
    <div className="bracket-scroll">
      {rounds.map((round) => (
        <div className="bracket-round" key={round}>
          <div className="bracket-round-title">
            {t("gameDetail.round")} {round}
          </div>
          {matches
            .filter((m) => m.round === round)
            .map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                canEdit={canEdit}
                onSetWinner={(side) => onSetWinner(m.id, side)}
                onDelete={() => onDelete(m.id)}
                t={t}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
