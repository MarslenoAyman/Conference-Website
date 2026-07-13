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
  signup: (name, phone) => request("/auth/signup", { method: "POST", body: { name, phone } }),
  me: (token) => request("/auth/me", { token }),

  getInstructions: (token) => request("/instructions", { token }),
  addInstruction: (token, text) => request("/instructions", { method: "POST", body: { text }, token }),
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
  addGame: (token, game) => request("/games", { method: "POST", body: game, token }),
  updateGame: (token, id, game) => request(`/games/${id}`, { method: "PUT", body: game, token }),
  deleteGame: (token, id) => request(`/games/${id}`, { method: "DELETE", token }),

  getTeams: (token) => request("/teams", { token }),
  addTeam: (token, name, color) => request("/teams", { method: "POST", body: { name, color }, token }),
  updateTeam: (token, id, team) => request(`/teams/${id}`, { method: "PUT", body: team, token }),
  deleteTeam: (token, id) => request(`/teams/${id}`, { method: "DELETE", token }),
  adjustTeamPoints: (token, id, delta) => request(`/teams/${id}/points`, { method: "POST", body: { delta }, token }),
  assignToTeam: (token, teamId, userId) =>
    request(`/teams/${teamId}/assign`, { method: "POST", body: { userId }, token }),
  unassign: (token, userId) => request(`/teams/unassign`, { method: "POST", body: { userId }, token }),

  getBonusMembers: (token) => request("/bonus", { token }),
  adjustBonus: (token, userId, delta, reason) =>
    request(`/bonus/${userId}`, { method: "POST", body: { delta, reason }, token }),

  getUsers: (token) => request("/users", { token }),
};
