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

-- Named instruction categories ("Spiritual", "Games", …); each holds its own
-- instructions.
CREATE TABLE IF NOT EXISTS instruction_sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE instructions ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES instruction_sections(id) ON DELETE CASCADE;

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
-- When true, every served member can see this game's full details (e.g. the
-- Card Game), not just participants.
ALTER TABLE games ADD COLUMN IF NOT EXISTS all_served_view BOOLEAN NOT NULL DEFAULT false;
-- When true, a players-type game offers singles only (no doubles/couple), e.g. Tawla.
ALTER TABLE games ADD COLUMN IF NOT EXISTS singles_only BOOLEAN NOT NULL DEFAULT false;

-- Showcase cards for a "showcase" game (e.g. the Card Game: Screw, Cochina).
-- Each card is a titled tile with a drawn art style and optional subtitle.
CREATE TABLE IF NOT EXISTS game_cards (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  art TEXT NOT NULL DEFAULT 'card',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Competitors formed on fixture generation for player games: one player
-- (singles) or two players (doubles / "couple"). player2_id null = singles.
CREATE TABLE IF NOT EXISTS game_pairs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
-- Ordering for manually-built entries (Play Station); harmless for auto pairs.
ALTER TABLE game_pairs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Match competitor slots for player games (reference game_pairs; nullable for
-- cup bracket TBD slots).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pair_a_id TEXT REFERENCES game_pairs(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pair_b_id TEXT REFERENCES game_pairs(id) ON DELETE SET NULL;

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

-- Tasks: full-access servants set tasks (with a reward and an optional timed
-- countdown) that served members complete for Bonus points.
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which served members have been marked as finishing a task (each award logged
-- in bonus_log at completion time).
CREATE TABLE IF NOT EXISTS task_completions (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Site-wide notifications polled by every signed-in user (toast cards).
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user watermark of the last notification they've seen, so each user gets
-- every notification exactly once even if they were offline when it fired.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;
