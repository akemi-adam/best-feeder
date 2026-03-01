import { db } from "../db/db.js";
import { getMatchIdsByPuuid, getMatchById } from "../riot/client.js";
import { extractParticipant } from "../riot/parse.js";

export const data = {
  name: "update",
  description: "Atualiza suas estatísticas puxando as últimas partidas.",
  options: [
    { type: 4, name: "count", description: "Quantas partidas (default 20)", required: false }
  ]
};

export async function execute(interaction) {
  const count = interaction.options.getInteger("count") ?? 20;

  const player = db.prepare("SELECT puuid FROM players WHERE discord_id = ?").get(interaction.user.id);
  if (!player) return interaction.reply({ content: "Você não está linkado. Use `/link Nome#TAG`.", ephemeral: true });

  await interaction.reply(`Atualizando últimas **${count}** partidas...`);

  try {
    const matchIds = await getMatchIdsByPuuid(player.puuid, Math.min(Math.max(count, 1), 50), 0);

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

    let fetched = 0;
    let skipped = 0;

    for (const matchId of matchIds) {
      const exists = hasMatchStmt.get(matchId);
      if (exists) { skipped++; continue; }

      const dto = await getMatchById(matchId);
      const info = dto?.info;

      insertMatch.run(matchId, info?.gameStartTimestamp ?? null, info?.queueId ?? null, Date.now());

      const part = extractParticipant(dto, player.puuid);
      if (part) {
        insertStats.run(
          matchId,
          player.puuid,
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

    // recalcular aggregates (simples e seguro)
    const agg = db.prepare(`
      SELECT
        COUNT(*) as games,
        COALESCE(SUM(kills),0) as total_kills,
        COALESCE(SUM(deaths),0) as total_deaths,
        COALESCE(SUM(assists),0) as total_assists
      FROM player_match_stats
      WHERE puuid = ?
    `).get(player.puuid);

    db.prepare(`
      UPDATE aggregates
      SET games = ?, total_kills = ?, total_deaths = ?, total_assists = ?, last_updated = ?
      WHERE puuid = ?
    `).run(agg.games, agg.total_kills, agg.total_deaths, agg.total_assists, Date.now(), player.puuid);

    return interaction.editReply(`✅ Update concluído. Baixei **${fetched}** partidas, pulei **${skipped}** já salvas.`);
  } catch (e) {
    return interaction.editReply(`❌ Erro no update: ${e.message}`);
  }
}