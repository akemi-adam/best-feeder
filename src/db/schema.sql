PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Identidade Riot (pode existir sem Discord)
CREATE TABLE IF NOT EXISTS riot_accounts (
  puuid TEXT PRIMARY KEY,
  riot_game_name TEXT NOT NULL,
  riot_tag_line TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_riot_accounts_riotid
ON riot_accounts(riot_game_name, riot_tag_line);

-- Link do Discord para um PUUID
CREATE TABLE IF NOT EXISTS user_links (
  discord_id TEXT PRIMARY KEY,
  puuid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (puuid) REFERENCES riot_accounts(puuid)
);

-- Match baixado uma vez só
CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  game_start_ts INTEGER,
  queue_id INTEGER,
  created_at INTEGER NOT NULL
);

-- Stats por participante no match.
-- IMPORTANTE: a gente vai inserir os 10 participantes no primeiro download do match.
CREATE TABLE IF NOT EXISTS player_match_stats (
  match_id TEXT NOT NULL,
  puuid TEXT NOT NULL,
  champion_name TEXT,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  win INTEGER,
  role TEXT,
  lane TEXT,
  PRIMARY KEY (match_id, puuid),
  FOREIGN KEY (match_id) REFERENCES matches(match_id)
);

-- Agregado só pros que interessam (vai ser calculado quando linkar/update)
CREATE TABLE IF NOT EXISTS aggregates (
  puuid TEXT PRIMARY KEY,
  games INTEGER NOT NULL,
  total_kills INTEGER NOT NULL,
  total_deaths INTEGER NOT NULL,
  total_assists INTEGER NOT NULL,
  last_updated INTEGER NOT NULL
);