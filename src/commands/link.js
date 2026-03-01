import { db } from "../db/db.js";
import { parseRiotId } from "../riot/parse.js";
import { getAccountByRiotId } from "../riot/client.js";

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

    // cria aggregates se não existir
    db.prepare(`
      INSERT INTO aggregates(puuid, games, total_kills, total_deaths, total_assists, last_updated)
      VALUES(?, 0, 0, 0, 0, ?)
      ON CONFLICT(puuid) DO NOTHING
    `).run(acc.puuid, now);

    return interaction.reply(`Vinculado ✅ **${parsed.gameName}#${parsed.tagLine}**`);
  } catch (e) {
    if (String(e.message).includes("RIOT_API_KEY_NOT_SET")) {
      return interaction.reply({ content: "Falta setar a key. Use `/key set`.", ephemeral: true });
    }
    return interaction.reply({ content: `Erro ao vincular: ${e.message}`, ephemeral: true });
  }
}