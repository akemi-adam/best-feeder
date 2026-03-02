import { db } from "../db/db.js";
import { parseRiotId } from "../riot/parse.js";
import { getAccountByRiotId } from "../riot/client.js";
import { updateRecentMatchesForPuuid } from "../services/updatePlayer.js";

export const data = {
  name: "link",
  description: "Vincula seu Discord ao seu Riot ID (ex: Ganest11#GPS).",
  options: [
    { type: 3, name: "riotid", description: "Seu Riot ID no formato Nome#TAG", required: true }
  ]
};

export async function execute(interaction) {
  const riotid = interaction.options.getString("riotid", true);
  const parsed = parseRiotId(riotid);
  if (!parsed) return interaction.reply({ content: "Formato inválido. Ex: `Ganest11#GPS`", ephemeral: true });

  await interaction.reply(`Vinculando **${parsed.gameName}#${parsed.tagLine}** e puxando as últimas **20** partidas...`);

  try {
    const acc = await getAccountByRiotId(parsed.gameName, parsed.tagLine);
    const now = Date.now();

    db.prepare(`
      INSERT INTO players(discord_id, riot_game_name, riot_tag_line, puuid, created_at)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        riot_game_name=excluded.riot_game_name,
        riot_tag_line=excluded.riot_tag_line,
        puuid=excluded.puuid
    `).run(interaction.user.id, parsed.gameName, parsed.tagLine, acc.puuid, now);

    // atualiza automaticamente 20
    const result = await updateRecentMatchesForPuuid(acc.puuid, 20);

    return interaction.editReply(
      `✅ Vinculado: **${parsed.gameName}#${parsed.tagLine}**\n` +
      `📦 Update automático: baixei **${result.fetched}**, pulei **${result.skipped}** (de ${result.total}).`
    );
  } catch (e) {
    if (String(e.message).includes("RIOT_API_KEY_NOT_SET")) {
      return interaction.editReply("Falta setar a key. Use `/key set`.");
    }
    return interaction.editReply(`Erro ao vincular: ${e.message}`);
  }
}