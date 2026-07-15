CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5b6b4a',
  points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'none',
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  bonus INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
UPDATE users SET password = phone WHERE password IS NULL AND phone IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_password_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_password_key UNIQUE (password);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS instructions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timeline_days (
  id TEXT PRIMARY KEY,
  day_number INTEGER NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_sessions (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES timeline_days(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  speaker TEXT NOT NULL DEFAULT 'TBD',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  when_text TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE games ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'roster';
ALTER TABLE games ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'ball';
ALTER TABLE games ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'league';
ALTER TABLE games ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN IF NOT EXISTS manager TEXT NOT NULL DEFAULT '';
-- Whether a roster game's League/Cup fixtures have been generated yet.
ALTER TABLE games ADD COLUMN IF NOT EXISTS fixtures_ready BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS game_rosters (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS game_teams (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5b6b4a'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_rosters_team_id_fkey') THEN
    ALTER TABLE game_rosters DROP CONSTRAINT game_rosters_team_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_rosters_team_id_gameteams_fkey') THEN
    ALTER TABLE game_rosters
      ADD CONSTRAINT game_rosters_team_id_gameteams_fkey
      FOREIGN KEY (team_id) REFERENCES game_teams(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled',
  winner_side TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team-vs-team competition columns (roster games: Football etc.). For
-- duel/matchup games these stay null and match_players is used instead.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_id TEXT REFERENCES game_teams(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_id TEXT REFERENCES game_teams(id) ON DELETE CASCADE;
-- Cup bracket wiring: where this match's winner advances to.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_slot TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_pos INTEGER NOT NULL DEFAULT 0;
-- Football scoring: goals + cards per side (cards feed league tiebreakers).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_a INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_b INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS red_a INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS yellow_a INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS red_b INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS yellow_b INTEGER NOT NULL DEFAULT 0;

-- Individual-player games (Chess): the two competing players for a match
-- (parallel to team_a_id/team_b_id; nullable so cup brackets can hold TBD slots).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- The pool of individual players ("seats") added to a player-type game.
CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (game_id, user_id)
);

-- Live goal events for the current competition (cleared with their match on regenerate).
CREATE TABLE IF NOT EXISTS match_goals (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES game_teams(id) ON DELETE SET NULL
);

-- Banked goals from past (reset) competitions, so the scorer sheet survives regenerate.
CREATE TABLE IF NOT EXISTS player_goals (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goals INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS bonus_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bonus_log ADD COLUMN IF NOT EXISTS actor_id TEXT REFERENCES users(id) ON DELETE SET NULL;
