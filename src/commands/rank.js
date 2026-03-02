import { db } from "../db/db.js";

export const data = {
  name: "rank",
  description: "Ranking zoeiro do servidor (com base nos linkados).",
  options: [
    {
      type: 3,
      name: "type",
      description: "kills | deaths | assists",
      required: true,
      choices: [
        { name: "kills", value: "kills" },
        { name: "deaths", value: "deaths" },
        { name: "assists", value: "assists" },
      ]
    }
  ]
};

export async function execute(interaction) {
  const type = interaction.options.getString("type", true);

  const col =
    type === "kills" ? "a.total_kills" :
    type === "assists" ? "a.total_assists" :
    "a.total_deaths";

  const title =
    type === "kills" ? "🔪 Top Açougue" :
    type === "assists" ? "🛟 Top Carregado" :
    "💀 Top Cemitério";

  const rows = db.prepare(`
    SELECT
      ra.riot_game_name, ra.riot_tag_line,
      a.games, a.total_kills, a.total_deaths, a.total_assists,
      ul.discord_id AS claimed_discord_id
    FROM riot_accounts ra
    JOIN aggregates a ON a.puuid = ra.puuid
    LEFT JOIN user_links ul ON ul.puuid = ra.puuid
    ORDER BY ${col} DESC
    LIMIT 10
  `).all();

  if (rows.length === 0) return interaction.reply("Ninguém linkado ainda. Use `/link Nome#TAG`.");

  const lines = rows.map((r, i) => {
    const val = type === "kills" ? r.total_kills : type === "assists" ? r.total_assists : r.total_deaths;
    const badge = r.claimed_discord_id ? "" : " *🔺*";
    return `${i + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — ${val} (em ${r.games} jogos)${badge}`;
  });

  return interaction.reply([title, ...lines].join("\n"));
}