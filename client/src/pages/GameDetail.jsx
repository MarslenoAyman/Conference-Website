import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { gameName } from "../i18n.js";
import { api } from "../api.js";
import { GAME_ICONS, GAME_ICON_COLORS } from "../gameIcons.jsx";
import { CARD_ART, CARD_ART_KEYS, CardArt } from "../cardArt.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
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

  async function reloadGame() {
    const { game: fresh } = await api.getGame(token, id);
    setGame(fresh);
  }

  async function addSurvivor(userId) {
    try {
      await api.addGamePlayer(token, id, userId);
      const { game: fresh } = await api.getGame(token, id);
      setGame(fresh);
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function removeSurvivor(userId) {
    try {
      await api.removeGamePlayer(token, id, userId);
      const { game: fresh } = await api.getGame(token, id);
      setGame(fresh);
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function setEliminated(userId, eliminated) {
    try {
      const { players } = await api.setSurvivor(token, id, userId, eliminated);
      setGame((prev) => ({ ...prev, players, survivorCount: players.filter((p) => !p.eliminated).length }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function resetSurvivors() {
    try {
      const { players } = await api.resetSurvivors(token, id);
      setGame((prev) => ({ ...prev, players, survivorCount: players.filter((p) => !p.eliminated).length }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  // Play Station: each card (FIFA/PES) is its own competition. All these calls
  // return the full { cards } array, which we drop straight into game state.
  async function stationAction(fn) {
    try {
      const { cards } = await fn();
      setGame((prev) => ({ ...prev, cards }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  const addCardEntry = (cardId, playerIds) => stationAction(() => api.addStationEntry(token, id, cardId, playerIds));
  const removeCardEntry = (cardId, pairId) => stationAction(() => api.removeStationEntry(token, id, cardId, pairId));
  const generateCard = (cardId, format) => stationAction(() => api.generateStationCard(token, id, cardId, format));
  const setCardWinner = (matchId, winnerSide) => stationAction(() => api.setMatchWinner(token, id, matchId, winnerSide));

  async function addCard(card) {
    try {
      const { cards } = await api.addGameCard(token, id, card);
      setGame((prev) => ({ ...prev, cards }));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function removeCard(cardId) {
    try {
      const { cards } = await api.removeGameCard(token, id, cardId);
      setGame((prev) => ({ ...prev, cards }));
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

  // Served members who aren't part of this game see the header only, not the
  // rosters/players/competition. The server omits those fields for them.
  if (user.role === "none" && game.participant === false) {
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
              {gameName(game, t)}
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
        <div className="card not-participant-card">
          <span className="not-participant-icon">🔒</span>
          <p>{t("gameDetail.notParticipant")}</p>
        </div>
      </div>
    );
  }

  const manageTeam = manageTeamId ? game.rosters.find((r) => r.teamId === manageTeamId) : null;

  let cupChampion = null;
  if (
    (game.type === "roster" || game.type === "players" || game.type === "station") &&
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
            {gameName(game, t)}
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

      {game.type === "showcase" ? (
        <ShowcaseView cards={game.cards || []} canEdit={canEdit} onAdd={addCard} onRemove={removeCard} t={t} />
      ) : game.type === "survival" ? (
        <SurvivalView
          game={game}
          canEdit={canEdit}
          allUsers={allUsers}
          onAdd={addSurvivor}
          onRemove={removeSurvivor}
          onSetEliminated={setEliminated}
          onReset={resetSurvivors}
          t={t}
        />
      ) : game.type === "rumble" ? (
        <RumbleView game={game} canEdit={canEdit} token={token} reload={reloadGame} onError={setError} t={t} />
      ) : game.type === "station" ? (
        <StationView
          cards={game.cards || []}
          canEdit={canEdit}
          allUsers={allUsers}
          onAddEntry={addCardEntry}
          onRemoveEntry={removeCardEntry}
          onGenerate={generateCard}
          onSetWinner={setCardWinner}
          t={t}
        />
      ) : game.type === "roster" ? (
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
          <div className="players-section">
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
                    {!game.singlesOnly && (
                      <span>
                        {t("gameDetail.mode")}:{" "}
                        <strong>{game.teamSize === 2 ? t("gameDetail.doubles") : t("gameDetail.singles")}</strong>
                      </span>
                    )}
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
                {!game.singlesOnly && (
                  <div className="format-toggle">
                    <button className={chosenTeamSize === 1 ? "active" : ""} onClick={() => setChosenTeamSize(1)}>
                      {t("gameDetail.singles")}
                    </button>
                    <button className={chosenTeamSize === 2 ? "active" : ""} onClick={() => setChosenTeamSize(2)}>
                      {t("gameDetail.doubles")}
                    </button>
                  </div>
                )}
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

function rumbleFmt(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function RumbleView({ game, canEdit, token, reload, onError, t }) {
  const [now, setNow] = useState(Date.now());
  const [showAddTask, setShowAddTask] = useState(false);
  const [draft, setDraft] = useState({ title: "", instructions: "", points: "", hours: "", minutes: "" });
  const [awardTask, setAwardTask] = useState(null);
  const [confirm, setConfirm] = useState(null); // {kind, id?}

  const teams = game.rumbleTeams || [];
  const tasks = game.tasks || [];
  const ringMembers = teams.flatMap((tm) => tm.members.filter((m) => m.inRing));
  const stillIn = ringMembers.filter((m) => !m.eliminated).length;
  const anyEliminated = ringMembers.some((m) => m.eliminated);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function run(fn) {
    try {
      await fn();
      await reload();
    } catch (err) {
      onError(err.message);
    }
  }

  async function submitTask(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const durationSeconds = (Number(draft.hours) || 0) * 3600 + (Number(draft.minutes) || 0) * 60;
    await run(() =>
      api.addRumbleTask(token, game.id, {
        title: draft.title.trim(),
        instructions: draft.instructions.trim(),
        points: Number(draft.points) || 0,
        durationSeconds,
      })
    );
    setDraft({ title: "", instructions: "", points: "", hours: "", minutes: "" });
    setShowAddTask(false);
  }

  return (
    <>
      <div className="competition-head">
        <h2 className="competition-title">🤼 {t("gameDetail.theRing")}</h2>
        <div className="competition-stats">
          <span>
            {t("gameDetail.stillIn")}: <strong>{stillIn}</strong>
          </span>
          {ringMembers.length > 0 && (
            <span>
              {t("gameDetail.inRing")}: <strong>{ringMembers.length}</strong>
            </span>
          )}
        </div>
      </div>

      {canEdit && anyEliminated && (
        <div className="competition-controls">
          <button className="btn btn-sm btn-primary" onClick={() => setConfirm({ kind: "resetRing" })}>
            {t("gameDetail.resetRing")}
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noRumbleTeams")}</p>
      ) : (
        <div className="rumble-teams-grid">
          {teams.map((tm) => (
            <div className="rumble-team-col" key={tm.teamId}>
              <div className="rumble-team-banner" style={{ background: tm.color }}>
                <span>{tm.teamName}</span>
                <span className="rumble-team-count">
                  {tm.members.filter((m) => m.inRing && !m.eliminated).length}/{tm.members.length}
                </span>
              </div>
              <div className="rumble-team-members">
                {tm.members.map((m) => (
                  <div
                    className={"rumble-member" + (m.inRing ? " in-ring" : "") + (m.eliminated ? " eliminated" : "")}
                    key={m.id}
                  >
                    <span className="rumble-member-name">{m.name}</span>
                    {m.inRing && (
                      <span className={"survival-badge " + (m.eliminated ? "out" : "in")}>
                        {m.eliminated ? t("gameDetail.out") : t("gameDetail.inRingShort")}
                      </span>
                    )}
                    {canEdit && (
                      <div className="rumble-member-actions">
                        {!m.inRing ? (
                          <button className="btn btn-xs" onClick={() => run(() => api.addRingPlayer(token, game.id, m.id))}>
                            {t("gameDetail.addToRing")}
                          </button>
                        ) : m.eliminated ? null : (
                          <>
                            <button
                              className="btn btn-xs btn-danger"
                              onClick={() => run(() => api.setRingPlayer(token, game.id, m.id, true))}
                            >
                              {t("gameDetail.eliminate")}
                            </button>
                            <button
                              className="btn btn-xs"
                              onClick={() => run(() => api.removeRingPlayer(token, game.id, m.id))}
                            >
                              {t("gameDetail.removeFromRing")}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-gap">
        <div className="competition-head">
          <h2 className="competition-title">{t("gameDetail.rumbleTasks")}</h2>
        </div>
        {canEdit &&
          (showAddTask ? (
            <form className="add-box card" onSubmit={submitTask}>
              <div className="field">
                <label>{t("gameDetail.taskTitle")}</label>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("gameDetail.taskInstructions")}</label>
                <textarea rows={2} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
              </div>
              <div className="add-game-grid">
                <div className="field">
                  <label>{t("gameDetail.taskPoints")}</label>
                  <input inputMode="numeric" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value.replace(/[^0-9]/g, "") })} />
                </div>
                <div className="field">
                  <label>{t("tasks.hoursPlaceholder")} / {t("tasks.minutesPlaceholder")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input inputMode="numeric" placeholder="0" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value.replace(/[^0-9]/g, "") })} />
                    <input inputMode="numeric" placeholder="0" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                </div>
              </div>
              <div className="card-actions">
                <button className="btn btn-primary btn-sm" type="submit">{t("common.save")}</button>
                <button className="btn btn-sm" type="button" onClick={() => setShowAddTask(false)}>{t("common.cancel")}</button>
              </div>
            </form>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowAddTask(true)}>+ {t("gameDetail.addTask")}</button>
          ))}

        {tasks.length === 0 ? (
          <p className="empty-note" style={{ marginTop: 16 }}>{t("gameDetail.noTasksYet")}</p>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {tasks.map((task) => {
              const launched = !!task.launchedAt;
              const remaining = launched
                ? Math.min(task.durationSeconds, task.durationSeconds - (now - new Date(task.launchedAt).getTime()) / 1000)
                : task.durationSeconds;
              const timeUp = launched && remaining <= 0;
              return (
                <div className={"rumble-task" + (timeUp ? " task-timeup" : "")} key={task.id}>
                  <div className="rumble-task-head">
                    <span className="rumble-task-title">{task.title}</span>
                    <span className="rumble-task-points">+{task.points} {t("teams.points")}</span>
                  </div>
                  {task.instructions && <p className="rumble-task-instr">{task.instructions}</p>}
                  {task.durationSeconds > 0 && (
                    <div className="rumble-task-timer">
                      ⏱ {timeUp ? t("tasks.timeUp") : rumbleFmt(remaining)}
                    </div>
                  )}
                  {canEdit && (
                    <div className="card-actions">
                      {!launched && task.durationSeconds > 0 && (
                        <button className="btn btn-sm btn-primary" onClick={() => run(() => api.launchRumbleTask(token, game.id, task.id))}>
                          {t("tasks.launch")}
                        </button>
                      )}
                      {teams.length > 0 && (
                        <button className="btn btn-sm" onClick={() => setAwardTask(task)}>
                          {t("gameDetail.award")}
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirm({ kind: "removeTask", id: task.id })}>
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {awardTask && (
        <Modal title={`${t("gameDetail.award")}: ${awardTask.title}`} onClose={() => setAwardTask(null)}>
          <p className="empty-note" style={{ marginTop: 0 }}>
            +{awardTask.points} {t("teams.points")}
          </p>
          {teams.map((tm) => (
            <div className="member-pick-row" key={tm.teamId}>
              <span className="member-pick-name">
                {tm.teamName} <span className="rumble-team-points">· {tm.points} {t("teams.points")}</span>
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={() =>
                  run(() => api.awardRumbleTask(token, game.id, awardTask.id, tm.teamId)).then(() => setAwardTask(null))
                }
              >
                {t("gameDetail.award")}
              </button>
            </div>
          ))}
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          message={
            confirm.kind === "resetRing"
              ? t("gameDetail.resetRingConfirm")
              : t("common.confirmDeleteGeneric")
          }
          danger={confirm.kind !== "resetRing"}
          confirmLabel={confirm.kind === "resetRing" ? t("gameDetail.resetRing") : t("common.delete")}
          onConfirm={() => {
            if (confirm.kind === "resetRing") run(() => api.resetRing(token, game.id));
            else if (confirm.kind === "removeTask") run(() => api.deleteRumbleTask(token, game.id, confirm.id));
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function SurvivalView({ game, canEdit, allUsers, onAdd, onRemove, onSetEliminated, onReset, t }) {
  const [showAdd, setShowAdd] = useState(false);
  const [confirm, setConfirm] = useState(null); // {type, id}
  const players = game.players || [];
  const survivors = players.filter((p) => !p.eliminated);
  const eliminated = players.filter((p) => p.eliminated);

  return (
    <>
      <div className="competition-head">
        <h2 className="competition-title">{t("gameDetail.survivalBoard")}</h2>
        <div className="competition-stats">
          <span>
            {t("gameDetail.stillIn")}: <strong>{survivors.length}</strong>
          </span>
          <span>
            {t("gameDetail.eliminatedCount")}: <strong>{eliminated.length}</strong>
          </span>
        </div>
      </div>

      {canEdit && (
        <div className="competition-controls">
          <button className="btn btn-sm" onClick={() => setShowAdd(true)}>
            + {t("gameDetail.addPlayer")}
          </button>
          {eliminated.length > 0 && (
            <button className="btn btn-sm btn-primary" onClick={() => setConfirm({ type: "reset" })}>
              {t("gameDetail.dailyReset")}
            </button>
          )}
        </div>
      )}

      {players.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noPlayersYet")}</p>
      ) : (
        <div className="survival-grid">
          {players.map((p) => (
            <div className={"survival-card" + (p.eliminated ? " eliminated" : "")} key={p.id}>
              <span className="survival-name">{p.name}</span>
              <span className={"survival-badge " + (p.eliminated ? "out" : "in")}>
                {p.eliminated ? t("gameDetail.out") : t("gameDetail.in")}
              </span>
              {canEdit && (
                <div className="survival-actions">
                  <button className="btn btn-sm" onClick={() => onSetEliminated(p.id, !p.eliminated)}>
                    {p.eliminated ? t("gameDetail.revive") : t("gameDetail.eliminate")}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirm({ type: "remove", id: p.id })}>
                    {t("common.delete")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddPlayerModal
          allUsers={allUsers}
          poolIds={new Set(players.map((p) => p.id))}
          onAdd={onAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.type === "reset" ? t("gameDetail.dailyResetConfirm") : t("common.confirmDeleteGeneric")}
          danger={confirm.type === "remove"}
          confirmLabel={confirm.type === "reset" ? t("gameDetail.dailyReset") : t("common.delete")}
          onConfirm={() => {
            if (confirm.type === "reset") onReset();
            else onRemove(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// Play Station: FIFA and PES each are their own competition. The cards are
// clickable; clicking one opens that card's competition (entries + league/cup).
function StationView({ cards, canEdit, allUsers, onAddEntry, onRemoveEntry, onGenerate, onSetWinner, t }) {
  const [openId, setOpenId] = useState(null);
  const openCard = cards.find((c) => c.id === openId) || null;

  return (
    <>
      {cards.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noCardsYet")}</p>
      ) : (
        <div className="card-showcase-grid">
          {cards.map((c) => (
            <button className="showcase-card station-card" key={c.id} onClick={() => setOpenId(c.id)}>
              <div className="showcase-card-art">
                <CardArt art={c.art} alt={c.title} />
              </div>
              <h3 className="showcase-card-title">{c.title}</h3>
              <span className="station-card-meta">
                {c.fixturesReady
                  ? `${c.format === "cup" ? t("gameDetail.cup") : t("gameDetail.league")} · ${c.entryCount}`
                  : c.entryCount
                  ? `${c.entryCount} ${t("gameDetail.entries")}`
                  : t("gameDetail.tapToSetUp")}
              </span>
              <span className="open-link">{t("gameDetail.openCard")}</span>
            </button>
          ))}
        </div>
      )}

      {openCard && (
        <StationCardModal
          card={openCard}
          canEdit={canEdit}
          allUsers={allUsers}
          onAddEntry={(playerIds) => onAddEntry(openCard.id, playerIds)}
          onRemoveEntry={(pairId) => onRemoveEntry(openCard.id, pairId)}
          onGenerate={(format) => onGenerate(openCard.id, format)}
          onSetWinner={onSetWinner}
          onClose={() => setOpenId(null)}
          t={t}
        />
      )}
    </>
  );
}

function StationCardModal({ card, canEdit, allUsers, onAddEntry, onRemoveEntry, onGenerate, onSetWinner, onClose, t }) {
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [chosenFormat, setChosenFormat] = useState(card.format || "league");
  const [confirmId, setConfirmId] = useState(null);
  const entries = card.entries || [];
  const matches = card.matches || [];

  let champion = null;
  if (card.format === "cup" && card.fixturesReady && matches.length) {
    const maxRound = Math.max(...matches.map((m) => m.round));
    const final = matches.find((m) => m.round === maxRound);
    if (final && final.status === "done" && final.winnerSide) {
      const side = final.winnerSide === "a" ? final.sideA : final.sideB;
      champion = side.length ? side.map((p) => p.name).join(" & ") : null;
    }
  }

  return (
    <Modal title={card.title} onClose={onClose} wide>
      <div className="players-section" style={{ marginTop: 0 }}>
        <div className="competition-head">
          <h2 className="competition-title">{t("gameDetail.entries")}</h2>
          <span className="competition-stats">
            <span>
              {t("gameDetail.entriesCount")}: <strong>{entries.length}</strong>
            </span>
          </span>
        </div>
        <div className="card">
          {entries.length === 0 ? (
            <p className="empty-note">{t("gameDetail.noEntriesYet")}</p>
          ) : (
            entries.map((e) => (
              <div className="member-row" key={e.id}>
                <span>
                  <span className={"entry-mode entry-mode--" + e.mode}>
                    {e.mode === "multi" ? t("gameDetail.multi") : t("gameDetail.single")}
                  </span>
                  {e.players.map((p) => p.name).join(" & ")}
                </span>
                {canEdit && (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmId(e.id)}>
                    {t("common.delete")}
                  </button>
                )}
              </div>
            ))
          )}
          {canEdit && (
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAddEntry(true)}>
              + {t("gameDetail.addEntry")}
            </button>
          )}
        </div>
      </div>

      <div className="section-gap" style={{ marginTop: "var(--space-lg)" }}>
        <div className="competition-head">
          <h2 className="competition-title">{t("gameDetail.competition")}</h2>
          {card.fixturesReady && (
            <span className="competition-stats">
              <span>
                {t("gameDetail.system")}:{" "}
                <strong>{card.format === "cup" ? t("gameDetail.cup") : t("gameDetail.league")}</strong>
              </span>
            </span>
          )}
        </div>

        {canEdit && entries.length >= 2 && (
          <div className="competition-controls">
            <div className="format-toggle">
              <button className={chosenFormat === "league" ? "active" : ""} onClick={() => setChosenFormat("league")}>
                {t("gameDetail.league")}
              </button>
              <button className={chosenFormat === "cup" ? "active" : ""} onClick={() => setChosenFormat("cup")}>
                {t("gameDetail.cup")}
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onGenerate(chosenFormat)}>
              {card.fixturesReady
                ? t("gameDetail.regenerate")
                : chosenFormat === "cup"
                ? t("gameDetail.generateCup")
                : t("gameDetail.generateLeague")}
            </button>
          </div>
        )}

        {entries.length < 2 ? (
          <p className="empty-note">{t("gameDetail.needTwoEntries")}</p>
        ) : !card.fixturesReady ? (
          <p className="empty-note">{t("gameDetail.notGeneratedYet")}</p>
        ) : card.format === "cup" ? (
          <>
            {champion && (
              <div className="champion-banner">
                🏆 {t("gameDetail.champion")}: <strong>{champion}</strong>
              </div>
            )}
            <BracketView
              matches={matches}
              t={t}
              renderMatch={(m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  canEdit={canEdit}
                  onSetWinner={(side) => onSetWinner(m.id, side)}
                  onDelete={() => {}}
                  showDelete={false}
                  t={t}
                />
              )}
            />
          </>
        ) : (
          <>
            <PlayerStandings standings={card.standings} t={t} />
            <div style={{ marginTop: 20 }}>
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  canEdit={canEdit}
                  onSetWinner={(side) => onSetWinner(m.id, side)}
                  onDelete={() => {}}
                  showDelete={false}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showAddEntry && (
        <AddEntryModal allUsers={allUsers} onAdd={onAddEntry} onClose={() => setShowAddEntry(false)} t={t} />
      )}
      {confirmId && (
        <ConfirmModal
          message={t("common.confirmDeleteGeneric")}
          danger
          confirmLabel={t("common.delete")}
          onConfirm={() => {
            onRemoveEntry(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </Modal>
  );
}

function AddEntryModal({ allUsers, onAdd, onClose, t }) {
  const [mode, setMode] = useState("single");
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const need = mode === "multi" ? 2 : 1;
  const q = query.trim().toLowerCase();
  const candidates = allUsers.filter((u) => !picked.includes(u.id) && (!q || u.name.toLowerCase().includes(q)));
  const nameById = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

  function toggleMode(m) {
    setMode(m);
    setPicked((prev) => prev.slice(0, m === "multi" ? 2 : 1));
  }
  function pick(uid) {
    setPicked((prev) => (prev.length >= need ? prev : [...prev, uid]));
  }
  async function submit() {
    if (picked.length !== need) {
      setError(need === 2 ? t("gameDetail.pickTwoPlayers") : t("gameDetail.pickOnePlayer"));
      return;
    }
    await onAdd(picked);
    onClose();
  }

  return (
    <Modal title={t("gameDetail.addEntry")} onClose={onClose}>
      <Alert message={error} onDismiss={() => setError("")} />
      <div className="format-toggle" style={{ marginBottom: 14 }}>
        <button className={mode === "single" ? "active" : ""} onClick={() => toggleMode("single")}>
          {t("gameDetail.single")}
        </button>
        <button className={mode === "multi" ? "active" : ""} onClick={() => toggleMode("multi")}>
          {t("gameDetail.multi")}
        </button>
      </div>
      <div className="entry-picked">
        {picked.length === 0 ? (
          <span className="empty-note">{need === 2 ? t("gameDetail.pickTwoPlayers") : t("gameDetail.pickOnePlayer")}</span>
        ) : (
          picked.map((uid) => (
            <span className="entry-chip" key={uid}>
              {nameById[uid]}
              <button onClick={() => setPicked((prev) => prev.filter((x) => x !== uid))}>×</button>
            </span>
          ))
        )}
      </div>
      {picked.length < need && (
        <>
          <input
            type="text"
            placeholder={t("teams.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", margin: "10px 0" }}
          />
          {candidates.map((u) => (
            <div className="member-pick-row" key={u.id}>
              <span className="member-pick-name">{u.name}</span>
              <button className="btn btn-sm btn-primary" onClick={() => pick(u.id)}>
                {t("gameDetail.select")}
              </button>
            </div>
          ))}
        </>
      )}
      <div className="card-actions" style={{ marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={submit}>
          {t("common.save")}
        </button>
        <button className="btn btn-sm" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </Modal>
  );
}

function ShowcaseView({ cards, canEdit, onAdd, onRemove, t }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [art, setArt] = useState(CARD_ART_KEYS[0]);
  const [confirmId, setConfirmId] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd({ title: title.trim(), subtitle: subtitle.trim(), art });
    setTitle("");
    setSubtitle("");
    setArt(CARD_ART_KEYS[0]);
    setShowAdd(false);
  }

  return (
    <div>
      {cards.length === 0 ? (
        <p className="empty-note">{t("gameDetail.noCardsYet")}</p>
      ) : (
        <div className="card-showcase-grid">
          {cards.map((c) => (
            <div className="showcase-card" key={c.id}>
              <div className="showcase-card-art">
                <CardArt art={c.art} alt={c.title} />
              </div>
              <h3 className="showcase-card-title">{c.title}</h3>
              {c.subtitle && <p className="showcase-card-sub">{c.subtitle}</p>}
              {canEdit && (
                <button className="btn btn-sm btn-danger" onClick={() => setConfirmId(c.id)}>
                  {t("common.delete")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit &&
        (showAdd ? (
          <form className="add-box card" onSubmit={submit} style={{ marginTop: 20 }}>
            <div className="modal-section-title" style={{ marginTop: 0 }}>
              {t("gameDetail.addCard")}
            </div>
            <div className="field">
              <label>{t("gameDetail.cardTitle")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("gameDetail.cardTitle")} />
            </div>
            <div className="field">
              <label>{t("gameDetail.cardSubtitle")}</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={t("gameDetail.cardSubtitle")}
              />
            </div>
            <div className="field">
              <label>{t("gameDetail.cardArt")}</label>
              <div className="card-art-picker">
                {CARD_ART_KEYS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={"card-art-swatch" + (art === key ? " selected" : "")}
                    onClick={() => setArt(key)}
                    title={key}
                  >
                    {CARD_ART[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-actions">
              <button className="btn btn-primary btn-sm" type="submit">
                {t("common.save")}
              </button>
              <button className="btn btn-sm" type="button" onClick={() => setShowAdd(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowAdd(true)}>
            + {t("gameDetail.addCard")}
          </button>
        ))}

      {confirmId && (
        <ConfirmModal
          message={t("common.confirmDeleteGeneric")}
          danger
          confirmLabel={t("common.delete")}
          onConfirm={() => {
            onRemove(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
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
