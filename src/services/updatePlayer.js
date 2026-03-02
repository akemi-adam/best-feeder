import { db } from "../db/db.js";
import { getMatchIdsByPuuid, getMatchById } from "../riot/client.js";
import { extractParticipant } from "../riot/parse.js";

export async function updateRecentMatchesForPuuid(puuid, count = 20) {
  const safeCount = Math.min(Math.max(count, 1), 50);

  const matchIds = await getMatchIdsByPuuid(puuid, safeCount, 0);

  const hasMatchStmt = db.prepare("SELECT 1 FROM matches WHERE match_id = ?");
  const hasStatsStmt = db.prepare("SELECT 1 FROM player_match_stats WHERE match_id = ? AND puuid = ?");

  const insertMatch = db.prepare(`
    INSERT INTO matches(match_id, game_start_ts, queue_id, created_at)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(match_id) DO NOTHING
  `);

  const insertStats = db.prepare(`
    INSERT INTO player_match_stats(match_id, puuid, champion_name, kills, deaths, assists, win, role, lane)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id, puuid) DO NOTHING
  `);

  let fetched = 0;
  let skipped = 0;

  for (const matchId of matchIds) {
    // ✅ BUGFIX: não pular só porque o match existe.
    // Pula apenas se as stats DESSE PUUID nesse match já existirem.
    const alreadyHasStats = hasStatsStmt.get(matchId, puuid);
    if (alreadyHasStats) { skipped++; continue; }

    // se match não existe, baixa e salva; se existe, só precisamos das stats
    const matchExists = hasMatchStmt.get(matchId);

    let dto = null;
    if (!matchExists) {
      dto = await getMatchById(matchId);
      const info = dto?.info;

      insertMatch.run(matchId, info?.gameStartTimestamp ?? null, info?.queueId ?? null, Date.now());
    } else {
      // match existe, mas a gente ainda precisa do dto pra extrair participant do puuid
      dto = await getMatchById(matchId);
    }

    const part = extractParticipant(dto, puuid);
    if (part) {
      insertStats.run(
        matchId,
        puuid,
        part.championName ?? null,
        part.kills ?? 0,
        part.deaths ?? 0,
        part.assists ?? 0,
        part.win ? 1 : 0,
        part.role ?? null,
        part.lane ?? null
      );
    }

    fetched++;
  }

  // Recalcular aggregates (seguro)
  const agg = db.prepare(`
    SELECT
      COUNT(*) as games,
      COALESCE(SUM(kills),0) as total_kills,
      COALESCE(SUM(deaths),0) as total_deaths,
      COALESCE(SUM(assists),0) as total_assists
    FROM player_match_stats
    WHERE puuid = ?
  `).get(puuid);

  db.prepare(`
    INSERT INTO aggregates(puuid, games, total_kills, total_deaths, total_assists, last_updated)
    VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(puuid) DO UPDATE SET
      games=excluded.games,
      total_kills=excluded.total_kills,
      total_deaths=excluded.total_deaths,
      total_assists=excluded.total_assists,
      last_updated=excluded.last_updated
  `).run(puuid, agg.games, agg.total_kills, agg.total_deaths, agg.total_assists, Date.now());

  return { fetched, skipped, total: safeCount };
}