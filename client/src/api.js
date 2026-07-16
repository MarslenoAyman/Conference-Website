const BASE = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  signup: (username, password) => request("/auth/signup", { method: "POST", body: { username, password } }),
  me: (token) => request("/auth/me", { token }),

  getInstructions: (token) => request("/instructions", { token }),
  addInstructionSection: (token, name) =>
    request("/instructions/sections", { method: "POST", body: { name }, token }),
  deleteInstructionSection: (token, id) => request(`/instructions/sections/${id}`, { method: "DELETE", token }),
  addInstruction: (token, text, sectionId) =>
    request("/instructions", { method: "POST", body: { text, sectionId }, token }),
  updateInstruction: (token, id, text) => request(`/instructions/${id}`, { method: "PUT", body: { text }, token }),
  deleteInstruction: (token, id) => request(`/instructions/${id}`, { method: "DELETE", token }),

  getTimeline: (token) => request("/timeline", { token }),
  addDay: (token, label) => request("/timeline", { method: "POST", body: { label }, token }),
  renameDay: (token, dayId, label) => request(`/timeline/${dayId}`, { method: "PUT", body: { label }, token }),
  deleteDay: (token, dayId) => request(`/timeline/${dayId}`, { method: "DELETE", token }),
  addSession: (token, dayId, time, title) =>
    request(`/timeline/${dayId}/sessions`, { method: "POST", body: { time, title }, token }),
  deleteSession: (token, dayId, sessionId) =>
    request(`/timeline/${dayId}/sessions/${sessionId}`, { method: "DELETE", token }),

  getTopics: (token) => request("/topics", { token }),
  addTopic: (token, topic) => request("/topics", { method: "POST", body: topic, token }),
  updateTopic: (token, id, topic) => request(`/topics/${id}`, { method: "PUT", body: topic, token }),
  deleteTopic: (token, id) => request(`/topics/${id}`, { method: "DELETE", token }),

  getGames: (token) => request("/games", { token }),
  getGame: (token, id) => request(`/games/${id}`, { token }),
  addGame: (token, game) => request("/games", { method: "POST", body: game, token }),
  updateGame: (token, id, game) => request(`/games/${id}`, { method: "PUT", body: game, token }),
  deleteGame: (token, id) => request(`/games/${id}`, { method: "DELETE", token }),
  addGameTeam: (token, gameId, name, color) =>
    request(`/games/${gameId}/teams`, { method: "POST", body: { name, color }, token }),
  updateGameTeam: (token, gameId, teamId, team) =>
    request(`/games/${gameId}/teams/${teamId}`, { method: "PUT", body: team, token }),
  deleteGameTeam: (token, gameId, teamId) =>
    request(`/games/${gameId}/teams/${teamId}`, { method: "DELETE", token }),
  generateFixtures: (token, gameId, format, teamSize) =>
    request(`/games/${gameId}/generate`, { method: "POST", body: { format, teamSize }, token }),
  addGamePlayer: (token, gameId, userId) =>
    request(`/games/${gameId}/players`, { method: "POST", body: { userId }, token }),
  removeGamePlayer: (token, gameId, userId) =>
    request(`/games/${gameId}/players/${userId}`, { method: "DELETE", token }),
  addGameCard: (token, gameId, card) => request(`/games/${gameId}/cards`, { method: "POST", body: card, token }),
  removeGameCard: (token, gameId, cardId) => request(`/games/${gameId}/cards/${cardId}`, { method: "DELETE", token }),
  addStationEntry: (token, gameId, cardId, playerIds) =>
    request(`/games/${gameId}/cards/${cardId}/entries`, { method: "POST", body: { playerIds }, token }),
  removeStationEntry: (token, gameId, cardId, pairId) =>
    request(`/games/${gameId}/cards/${cardId}/entries/${pairId}`, { method: "DELETE", token }),
  generateStationCard: (token, gameId, cardId, format) =>
    request(`/games/${gameId}/cards/${cardId}/generate`, { method: "POST", body: { format }, token }),
  setSurvivor: (token, gameId, userId, eliminated) =>
    request(`/games/${gameId}/survivors/${userId}`, { method: "PUT", body: { eliminated }, token }),
  resetSurvivors: (token, gameId) => request(`/games/${gameId}/survivors/reset`, { method: "POST", token }),
  addRingPlayer: (token, gameId, userId) => request(`/games/${gameId}/ring`, { method: "POST", body: { userId }, token }),
  removeRingPlayer: (token, gameId, userId) => request(`/games/${gameId}/ring/${userId}`, { method: "DELETE", token }),
  setRingPlayer: (token, gameId, userId, eliminated) =>
    request(`/games/${gameId}/ring/${userId}`, { method: "PUT", body: { eliminated }, token }),
  resetRing: (token, gameId) => request(`/games/${gameId}/ring/reset`, { method: "POST", token }),
  addRumbleTask: (token, gameId, task) => request(`/games/${gameId}/tasks`, { method: "POST", body: task, token }),
  deleteRumbleTask: (token, gameId, taskId) => request(`/games/${gameId}/tasks/${taskId}`, { method: "DELETE", token }),
  launchRumbleTask: (token, gameId, taskId) =>
    request(`/games/${gameId}/tasks/${taskId}/launch`, { method: "POST", token }),
  awardRumbleTask: (token, gameId, taskId, teamId) =>
    request(`/games/${gameId}/tasks/${taskId}/award`, { method: "POST", body: { teamId }, token }),
  addToRoster: (token, gameId, teamId, userId) =>
    request(`/games/${gameId}/roster`, { method: "POST", body: { teamId, userId }, token }),
  removeFromRoster: (token, gameId, userId) =>
    request(`/games/${gameId}/roster/${userId}`, { method: "DELETE", token }),
  addMatch: (token, gameId, round, players) =>
    request(`/games/${gameId}/matches`, { method: "POST", body: { round, players }, token }),
  setMatchWinner: (token, gameId, matchId, winnerSide) =>
    request(`/games/${gameId}/matches/${matchId}`, { method: "PUT", body: { winnerSide }, token }),
  saveMatchResult: (token, gameId, matchId, result) =>
    request(`/games/${gameId}/matches/${matchId}`, { method: "PUT", body: result, token }),
  deleteMatch: (token, gameId, matchId) =>
    request(`/games/${gameId}/matches/${matchId}`, { method: "DELETE", token }),

  getTeams: (token) => request("/teams", { token }),
  addTeam: (token, name, color, manager) =>
    request("/teams", { method: "POST", body: { name, color, manager }, token }),
  updateTeam: (token, id, team) => request(`/teams/${id}`, { method: "PUT", body: team, token }),
  deleteTeam: (token, id) => request(`/teams/${id}`, { method: "DELETE", token }),
  adjustTeamPoints: (token, id, delta) => request(`/teams/${id}/points`, { method: "POST", body: { delta }, token }),
  assignToTeam: (token, teamId, userId) =>
    request(`/teams/${teamId}/assign`, { method: "POST", body: { userId }, token }),
  unassign: (token, userId) => request(`/teams/unassign`, { method: "POST", body: { userId }, token }),

  getRooms: (token) => request("/rooms", { token }),
  addRoom: (token, name, color) => request("/rooms", { method: "POST", body: { name, color }, token }),
  updateRoom: (token, id, room) => request(`/rooms/${id}`, { method: "PUT", body: room, token }),
  deleteRoom: (token, id) => request(`/rooms/${id}`, { method: "DELETE", token }),
  assignToRoom: (token, roomId, userId) =>
    request(`/rooms/${roomId}/assign`, { method: "POST", body: { userId }, token }),
  unassignRoom: (token, userId) => request(`/rooms/unassign`, { method: "POST", body: { userId }, token }),

  getBonusMembers: (token) => request("/bonus", { token }),
  getBonusHistory: (token) => request("/bonus/history", { token }),
  getMyBonus: (token) => request("/bonus/me", { token }),
  adjustBonus: (token, userId, delta, reason) =>
    request(`/bonus/${userId}`, { method: "POST", body: { delta, reason }, token }),
  deleteBonusMember: (token, userId) => request(`/bonus/${userId}`, { method: "DELETE", token }),

  getUsers: (token) => request("/users", { token }),

  getTasks: (token) => request("/tasks", { token }),
  addTask: (token, task) => request("/tasks", { method: "POST", body: task, token }),
  updateTask: (token, id, task) => request(`/tasks/${id}`, { method: "PUT", body: task, token }),
  deleteTask: (token, id) => request(`/tasks/${id}`, { method: "DELETE", token }),
  launchTask: (token, id) => request(`/tasks/${id}/launch`, { method: "POST", token }),
  completeTask: (token, id, userId) => request(`/tasks/${id}/complete`, { method: "POST", body: { userId }, token }),
  removeTaskCompletion: (token, id, userId) => request(`/tasks/${id}/complete/${userId}`, { method: "DELETE", token }),

  getNotifications: (token) => request("/notifications", { token }),
  markNotificationsSeen: (token, at) => request("/notifications/seen", { method: "POST", body: { at }, token }),
  clearNotifications: (token) => request("/notifications", { method: "DELETE", token }),
};
