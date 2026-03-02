import { db } from "../db/db.js";
import { getMatchIdsByPuuid, getMatchById } from "../riot/client.js";

export async function updateRecentMatchesForPuuid(puuid, count = 20) {
  const safeCount = Math.min(Math.max(count, 1), 50);

  const matchIds = await getMatchIdsByPuuid(puuid, safeCount, 0);

  const hasMatchStmt = db.prepare("SELECT 1 FROM matches WHERE match_id = ?");

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

  let fetchedMatches = 0;
  let skippedMatches = 0;

  for (const matchId of matchIds) {
    const exists = hasMatchStmt.get(matchId);
    if (exists) {
      skippedMatches++;
      continue; // ✅ não baixa duas vezes
    }

    const dto = await getMatchById(matchId);
    const info = dto?.info;

    insertMatch.run(
      matchId,
      info?.gameStartTimestamp ?? null,
      info?.queueId ?? null,
      Date.now()
    );

    const participants = info?.participants ?? [];

    // ✅ salva os 10 participantes (e pronto: ninguém nunca mais precisa baixar esse match)
    for (const p of participants) {
      insertStats.run(
        matchId,
        p.puuid,
        p.championName ?? null,
        p.kills ?? 0,
        p.deaths ?? 0,
        p.assists ?? 0,
        p.win ? 1 : 0,
        p.role ?? null,
        p.lane ?? null
      );
    }

    fetchedMatches++;
  }

  // ✅ Recalcula só o agregado do player que pediu update (simples e consistente)
  const agg = db.prepare(`
    SELECT
      COUNT(pms.match_id) as games,
      COALESCE(SUM(pms.kills),0) as total_kills,
      COALESCE(SUM(pms.deaths),0) as total_deaths,
      COALESCE(SUM(pms.assists),0) as total_assists
    FROM player_match_stats pms
    JOIN matches m ON m.match_id = pms.match_id
    WHERE pms.puuid = ?
    AND m.queue_id NOT IN (870, 880, 890)
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
  `).run(
    puuid,
    agg.games,
    agg.total_kills,
    agg.total_deaths,
    agg.total_assists,
    Date.now()
  );

  return { fetched: fetchedMatches, skipped: skippedMatches, total: safeCount };
}