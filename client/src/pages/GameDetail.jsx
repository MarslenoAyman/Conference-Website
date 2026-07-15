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
  const [chosenFormat, setChosenFormat] = useState("league");
  const [chosenTeamSize, setChosenTeamSize] = useState(1);
  const [resultMatch, setResultMatch] = useState(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const canEdit = user.role === "full";

  function load() {
    setLoading(true);
    const calls = [api.getGame(token, id)];
    if (canEdit) calls.push(api.getUsers(token));
    Promise.all(calls)
      .then(([g, usersRes]) => {
        setGame(g.game);
        setChosenFormat(g.game.format || "league");
        setChosenTeamSize(g.game.teamSize === 2 ? 2 : 1);
        if (usersRes) setAllUsers(usersRes.users || []);
      })
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function generateFixtures() {
    if (game.fixturesReady && !confirm(t("gameDetail.regenerateWarning"))) return;
    try {
      const { game: fresh } = await api.generateFixtures(token, id, chosenFormat, chosenTeamSize);
      setGame((prev) => ({ ...prev, ...fresh }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function addPlayer(userId) {
    try {
      const { players } = await api.addGamePlayer(token, id, userId);
      setGame((prev) => ({
        ...prev,
        players,
        playerCount: players.length,
        fixturesReady: false,
        matches: [],
        standings: prev.format === "league" ? [] : null,
      }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function removePlayer(userId) {
    try {
      const { players } = await api.removeGamePlayer(token, id, userId);
      setGame((prev) => ({
        ...prev,
        players,
        playerCount: players.length,
        fixturesReady: false,
        matches: [],
        standings: prev.format === "league" ? [] : null,
      }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

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
  async function saveResult(matchId, body) {
    const result = await api.saveMatchResult(token, id, matchId, body);
    setGame((prev) => ({
      ...prev,
      matches: result.matches,
      standings: result.standings,
      scorers: result.scorers ?? prev.scorers,
    }));
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

  let cupChampion = null;
  if (
    (game.type === "roster" || game.type === "players") &&
    game.format === "cup" &&
    game.fixturesReady &&
    game.matches?.length
  ) {
    const maxRound = Math.max(...game.matches.map((m) => m.round));
    const final = game.matches.find((m) => m.round === maxRound);
    if (final && final.status === "done" && final.winnerSide) {
      const side = final.winnerSide === "a" ? final.sideA : final.sideB;
      cupChampion = side.length ? side.map((p) => p.name).join(" & ") : null;
    }
  }

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
          {game.manager && (
            <p className="game-manager" style={{ marginTop: 6 }}>
              {t("games.responsible")}: <strong>{game.manager}</strong>
            </p>
          )}
        </div>
      </div>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {game.type === "roster" ? (
        <>
          <div className="grid-teams roster-grid">
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

          <div className="section-gap">
            <div className="competition-head">
              <h2 className="competition-title">{t("gameDetail.competition")}</h2>
              <div className="competition-stats">
                <span>
                  {t("gameDetail.teamsCount")}: <strong>{game.teamCount}</strong>
                </span>
                {game.fixturesReady && (
                  <span>
                    {t("gameDetail.system")}:{" "}
                    <strong>{game.format === "cup" ? t("gameDetail.cup") : t("gameDetail.league")}</strong>
                  </span>
                )}
              </div>
            </div>

            {canEdit && game.teamCount >= 2 && (
              <div className="competition-controls">
                <div className="format-toggle">
                  <button className={chosenFormat === "league" ? "active" : ""} onClick={() => setChosenFormat("league")}>
                    {t("gameDetail.league")}
                  </button>
                  <button className={chosenFormat === "cup" ? "active" : ""} onClick={() => setChosenFormat("cup")}>
                    {t("gameDetail.cup")}
                  </button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={generateFixtures}>
                  {game.fixturesReady
                    ? t("gameDetail.regenerate")
                    : chosenFormat === "cup"
                    ? t("gameDetail.generateCup")
                    : t("gameDetail.generateLeague")}
                </button>
              </div>
            )}

            {game.teamCount < 2 ? (
              <p className="empty-note">{t("gameDetail.needTwoTeams")}</p>
            ) : !game.fixturesReady ? (
              <p className="empty-note">{t("gameDetail.notGeneratedYet")}</p>
            ) : game.format === "cup" ? (
              <>
                {cupChampion && (
                  <div className="champion-banner">
                    🏆 {t("gameDetail.champion")}: <strong>{cupChampion}</strong>
                  </div>
                )}
                <BracketView
                  matches={game.matches}
                  t={t}
                  renderMatch={(m) => (
                    <TeamMatchCard key={m.id} match={m} canEdit={canEdit} onEnter={() => setResultMatch(m)} t={t} />
                  )}
                />
              </>
            ) : (
              <>
                <StandingsTable standings={game.standings} t={t} />
                <div style={{ marginTop: 20 }}>
                  {game.matches.map((m) => (
                    <TeamMatchCard key={m.id} match={m} canEdit={canEdit} onEnter={() => setResultMatch(m)} t={t} />
                  ))}
                </div>
              </>
            )}
          </div>

          <TopScorers scorers={game.scorers} t={t} />
        </>
      ) : game.type === "players" ? (
        <>
          <div className="section-gap">
            <div className="competition-head">
              <h2 className="competition-title">{t("gameDetail.players")}</h2>
              <div className="competition-stats">
                <span>
                  {t("gameDetail.playersCount")}: <strong>{game.playerCount}</strong>
                </span>
              </div>
            </div>
            <div className="card">
              {game.players.length === 0 ? (
                <p className="empty-note">{t("gameDetail.noPlayersInPool")}</p>
              ) : (
                game.players.map((p) => (
                  <div className="member-row" key={p.id}>
                    <span>{p.name}</span>
                    {canEdit && (
                      <button className="btn btn-sm btn-danger" onClick={() => removePlayer(p.id)}>
                        {t("gameDetail.removePlayer")}
                      </button>
                    )}
                  </div>
                ))
              )}
              {canEdit && (
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAddPlayer(true)}>
                  + {t("gameDetail.addPlayer")}
                </button>
              )}
            </div>
          </div>

          <div className="section-gap">
            <div className="competition-head">
              <h2 className="competition-title">{t("gameDetail.competition")}</h2>
              <div className="competition-stats">
                {game.fixturesReady && (
                  <>
                    <span>
                      {t("gameDetail.mode")}:{" "}
                      <strong>{game.teamSize === 2 ? t("gameDetail.doubles") : t("gameDetail.singles")}</strong>
                    </span>
                    <span>
                      {t("gameDetail.system")}:{" "}
                      <strong>{game.format === "cup" ? t("gameDetail.cup") : t("gameDetail.league")}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {canEdit && game.playerCount >= 2 && (
              <div className="competition-controls">
                <div className="format-toggle">
                  <button className={chosenTeamSize === 1 ? "active" : ""} onClick={() => setChosenTeamSize(1)}>
                    {t("gameDetail.singles")}
                  </button>
                  <button className={chosenTeamSize === 2 ? "active" : ""} onClick={() => setChosenTeamSize(2)}>
                    {t("gameDetail.doubles")}
                  </button>
                </div>
                <div className="format-toggle">
                  <button className={chosenFormat === "league" ? "active" : ""} onClick={() => setChosenFormat("league")}>
                    {t("gameDetail.league")}
                  </button>
                  <button className={chosenFormat === "cup" ? "active" : ""} onClick={() => setChosenFormat("cup")}>
                    {t("gameDetail.cup")}
                  </button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={generateFixtures}>
                  {game.fixturesReady
                    ? t("gameDetail.regenerate")
                    : chosenFormat === "cup"
                    ? t("gameDetail.generateCup")
                    : t("gameDetail.generateLeague")}
                </button>
              </div>
            )}

            {game.playerCount < 2 ? (
              <p className="empty-note">{t("gameDetail.needTwoPlayers")}</p>
            ) : !game.fixturesReady ? (
              <p className="empty-note">{t("gameDetail.notGeneratedYet")}</p>
            ) : game.format === "cup" ? (
              <>
                {cupChampion && (
                  <div className="champion-banner">
                    🏆 {t("gameDetail.champion")}: <strong>{cupChampion}</strong>
                  </div>
                )}
                <BracketView
                  matches={game.matches}
                  t={t}
                  renderMatch={(m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      canEdit={canEdit}
                      onSetWinner={(side) => setMatchWinner(m.id, side)}
                      onDelete={() => {}}
                      showDelete={false}
                      t={t}
                    />
                  )}
                />
              </>
            ) : (
              <>
                <PlayerStandings standings={game.standings} t={t} />
                <div style={{ marginTop: 20 }}>
                  {game.matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      canEdit={canEdit}
                      onSetWinner={(side) => setMatchWinner(m.id, side)}
                      onDelete={() => {}}
                      showDelete={false}
                      t={t}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
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
            <BracketView
              matches={game.matches}
              t={t}
              renderMatch={(m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  canEdit={canEdit}
                  onSetWinner={(side) => setMatchWinner(m.id, side)}
                  onDelete={() => deleteMatch(m.id)}
                  t={t}
                />
              )}
            />
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

      {resultMatch && (
        <ResultModal
          match={resultMatch}
          rosters={game.rosters}
          format={game.format}
          onSave={(body) => saveResult(resultMatch.id, body)}
          onClose={() => setResultMatch(null)}
        />
      )}

      {showAddPlayer && (
        <AddPlayerModal
          allUsers={allUsers}
          poolIds={new Set((game.players || []).map((p) => p.id))}
          onAdd={addPlayer}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
    </div>
  );
}

function AddPlayerModal({ allUsers, poolIds, onAdd, onClose }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const candidates = allUsers.filter((u) => !poolIds.has(u.id) && (!q || u.name.toLowerCase().includes(q)));
  return (
    <Modal title={t("gameDetail.addPlayer")} onClose={onClose}>
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
      {candidates.length === 0 ? (
        <p className="empty-note">{t("teams.noMembers")}</p>
      ) : (
        candidates.map((u) => (
          <div className="member-pick-row" key={u.id}>
            <span className="member-pick-name">{u.name}</span>
            <button className="btn btn-sm btn-primary" onClick={() => onAdd(u.id)}>
              {t("gameDetail.addPlayer")}
            </button>
          </div>
        ))
      )}
    </Modal>
  );
}

function PlayerStandings({ standings, t }) {
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="st-team">{t("gameDetail.colPlayer")}</th>
            <th>{t("gameDetail.colPlayed")}</th>
            <th>{t("gameDetail.colWin")}</th>
            <th>{t("gameDetail.colLoss")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td className="st-team">{s.name}</td>
              <td>{s.played}</td>
              <td>{s.wins}</td>
              <td>{s.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function MatchCard({ match, canEdit, onSetWinner, onDelete, showDelete = true, t }) {
  const nameList = (side) => side.map((p) => p.name).join(" & ") || t("gameDetail.awaiting");
  const ready = match.sideA.length > 0 && match.sideB.length > 0;
  return (
    <div className={"match-card" + (match.status === "done" ? " done" : "")}>
      <div className="match-sides">
        <div className={"match-side" + (match.winnerSide === "a" ? " winner" : "")}>{nameList(match.sideA)}</div>
        <span className="match-vs">{t("gameDetail.vs")}</span>
        <div className={"match-side" + (match.winnerSide === "b" ? " winner" : "")}>{nameList(match.sideB)}</div>
      </div>
      {canEdit && ready && (
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
          {showDelete && (
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              {t("common.delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BracketView({ matches, renderMatch, t }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  if (rounds.length === 0) return <p className="empty-note">{t("gameDetail.noMatchesYet")}</p>;
  return (
    <div className="bracket-scroll">
      {rounds.map((round) => (
        <div className="bracket-round" key={round}>
          <div className="bracket-round-title">
            {t("gameDetail.round")} {round}
          </div>
          {matches.filter((m) => m.round === round).map((m) => renderMatch(m))}
        </div>
      ))}
    </div>
  );
}

// Team-vs-team match card for a roster game (shows score + scorers + Enter result).
function TeamMatchCard({ match, canEdit, onEnter, t }) {
  const nameA = match.sideA[0]?.name || t("gameDetail.awaiting");
  const nameB = match.sideB[0]?.name || t("gameDetail.awaiting");
  const played = match.status === "done" && match.scoreA !== null && match.scoreA !== undefined;
  const ready = match.sideA.length > 0 && match.sideB.length > 0;
  const scorers = [...(match.scorersA || []), ...(match.scorersB || [])];
  return (
    <div className={"match-card" + (played ? " done" : "")}>
      <div className="match-sides">
        <div className={"match-side" + (match.winnerSide === "a" ? " winner" : "")}>{nameA}</div>
        <span className="match-score">{played ? `${match.scoreA} - ${match.scoreB}` : t("gameDetail.vs")}</span>
        <div className={"match-side" + (match.winnerSide === "b" ? " winner" : "")}>{nameB}</div>
      </div>
      {played && scorers.length > 0 && (
        <div className="match-scorers">⚽ {scorers.map((s) => s.name).join(", ")}</div>
      )}
      {canEdit && ready && (
        <div className="card-actions" style={{ marginTop: 10, justifyContent: "center" }}>
          <button className="btn btn-sm" onClick={onEnter}>
            {t("gameDetail.enterResult")}
          </button>
        </div>
      )}
    </div>
  );
}

function StandingsTable({ standings, t }) {
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="st-team">{t("gameDetail.colTeam")}</th>
            <th>{t("gameDetail.colPlayed")}</th>
            <th>{t("gameDetail.colWin")}</th>
            <th>{t("gameDetail.colDraw")}</th>
            <th>{t("gameDetail.colLoss")}</th>
            <th>{t("gameDetail.colGF")}</th>
            <th>{t("gameDetail.colGA")}</th>
            <th>{t("gameDetail.colGD")}</th>
            <th>🟨</th>
            <th>🟥</th>
            <th className="st-pts">{t("gameDetail.colPts")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td className="st-team">{s.name}</td>
              <td>{s.played}</td>
              <td>{s.wins}</td>
              <td>{s.draws}</td>
              <td>{s.losses}</td>
              <td>{s.gf}</td>
              <td>{s.ga}</td>
              <td>{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
              <td>{s.yellow}</td>
              <td>{s.red}</td>
              <td className="st-pts">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopScorers({ scorers, t }) {
  return (
    <div className="section-gap">
      <h2 className="competition-title" style={{ marginBottom: 16 }}>
        {t("gameDetail.topScorers")}
      </h2>
      {!scorers || scorers.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noScorersYet")}</p>
      ) : (
        <div className="card">
          {scorers.map((s, i) => (
            <div className="bonus-row" key={s.id}>
              <span className="bonus-rank">{i === 0 ? "🏆" : `#${i + 1}`}</span>
              <span className="bonus-name" style={{ flex: 1 }}>
                {s.name}
              </span>
              <span className="bonus-count">
                {s.goals} {t("gameDetail.goals")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultModal({ match, rosters, format, onSave, onClose }) {
  const { t, tError } = useLanguage();
  const teamA = match.sideA[0];
  const teamB = match.sideB[0];
  const playersA = rosters.find((r) => r.teamId === teamA?.id)?.players || [];
  const playersB = rosters.find((r) => r.teamId === teamB?.id)?.players || [];

  const [scoreA, setScoreA] = useState(String(match.scoreA ?? 0));
  const [scoreB, setScoreB] = useState(String(match.scoreB ?? 0));
  const [redA, setRedA] = useState(String(match.redA ?? 0));
  const [yellowA, setYellowA] = useState(String(match.yellowA ?? 0));
  const [redB, setRedB] = useState(String(match.redB ?? 0));
  const [yellowB, setYellowB] = useState(String(match.yellowB ?? 0));
  const [scorersA, setScorersA] = useState((match.scorersA || []).map((s) => s.id));
  const [scorersB, setScorersB] = useState((match.scorersB || []).map((s) => s.id));
  const [error, setError] = useState("");

  const isLeague = format === "league";
  const n = (v) => Number(v) || 0;

  async function submit() {
    if (format === "cup" && n(scoreA) === n(scoreB)) {
      setError(t("gameDetail.drawNotAllowedCup"));
      return;
    }
    const body = {
      scoreA: n(scoreA),
      scoreB: n(scoreB),
      redA: n(redA),
      yellowA: n(yellowA),
      redB: n(redB),
      yellowB: n(yellowB),
      scorers: [
        ...scorersA.filter(Boolean).map((userId) => ({ userId, side: "a" })),
        ...scorersB.filter(Boolean).map((userId) => ({ userId, side: "b" })),
      ],
    };
    try {
      await onSave(body);
      onClose();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function reset() {
    try {
      await onSave({ scoreA: null });
      onClose();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  const numField = (label, val, set) => (
    <div className="score-field">
      <label>{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={val}
        onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))}
      />
    </div>
  );

  const scorerPicker = (players, list, setList, teamName) => (
    <div className="field">
      <label>
        {teamName} — {t("gameDetail.scorers")}
      </label>
      {players.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noPlayersOnTeam")}</p>
      ) : (
        <>
          {list.map((uid, idx) => (
            <div className="scorer-row" key={idx}>
              <select value={uid} onChange={(e) => setList(list.map((v, i) => (i === idx ? e.target.value : v)))}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm btn-danger" onClick={() => setList(list.filter((_, i) => i !== idx))}>
                {t("common.delete")}
              </button>
            </div>
          ))}
          <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setList([...list, players[0].id])}>
            + {t("gameDetail.addScorer")}
          </button>
        </>
      )}
    </div>
  );

  return (
    <Modal title={t("gameDetail.enterResult")} onClose={onClose}>
      <Alert message={error} onDismiss={() => setError("")} />
      <div className="score-entry">
        {numField(teamA?.name || "A", scoreA, setScoreA)}
        <span className="score-dash">-</span>
        {numField(teamB?.name || "B", scoreB, setScoreB)}
      </div>

      {scorerPicker(playersA, scorersA, setScorersA, teamA?.name || "A")}
      {scorerPicker(playersB, scorersB, setScorersB, teamB?.name || "B")}

      {isLeague && (
        <>
          <div className="modal-section-title">
            {t("gameDetail.yellowCards")} / {t("gameDetail.redCards")}
          </div>
          <div className="cards-entry">
            <div className="cards-team">
              <span className="cards-team-name">{teamA?.name}</span>
              {numField("🟨", yellowA, setYellowA)}
              {numField("🟥", redA, setRedA)}
            </div>
            <div className="cards-team">
              <span className="cards-team-name">{teamB?.name}</span>
              {numField("🟨", yellowB, setYellowB)}
              {numField("🟥", redB, setRedB)}
            </div>
          </div>
        </>
      )}

      <div className="card-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={submit}>
          {t("common.save")}
        </button>
        {match.status === "done" && (
          <button className="btn btn-sm" onClick={reset}>
            {t("gameDetail.resetMatch")}
          </button>
        )}
        <button className="btn btn-sm" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </Modal>
  );
}
