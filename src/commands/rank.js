import { db } from "../db/db.js";

const BOT_QUEUES = "(870, 880, 890)";

export const data = {
  name: "rank",
  description: "Rankings zueiros e tops de campeões.",
  options: [
    { type: 1, name: "kills", description: "🔪 Top Açougue (total kills)" },
    { type: 1, name: "deaths", description: "💀 Top Cemitério (total deaths)" },
    { type: 1, name: "assists", description: "🛟 Top Carregado (total assists)" },
    {
      type: 2, // subcommand group
      name: "top",
      description: "Tops de campeões",
      options: [
        {
          type: 1,
          name: "my_champions",
          description: "Top 3 campeões mais jogados por você (precisa estar linkado).",
        },
        {
          type: 1,
          name: "champs",
          description: "Campeão mais jogado de cada pessoa (rank por maior número de jogos no mesmo champ).",
        }
      ]
    }
  ]
};

function fmtLine(i, player, champ, games) {
  return `${i}. **${player}** — **${champ}** (${games} jogos)`;
}

async function rankTotals(interaction, metric) {
  const col =
    metric === "kills" ? "a.total_kills" :
    metric === "assists" ? "a.total_assists" :
    "a.total_deaths";

  const title =
    metric === "kills" ? "🔪 Top Açougue" :
    metric === "assists" ? "🛟 Top Carregado" :
    "💀 Top Cemitério";

  // Mostra todos cadastrados, claimado ou não
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

  if (rows.length === 0) return interaction.reply("Ninguém cadastrado ainda. Use `/link add` ou `/link me`.");

  const lines = rows.map((r, idx) => {
    const val = metric === "kills" ? r.total_kills : metric === "assists" ? r.total_assists : r.total_deaths;
    const badge = r.claimed_discord_id ? "" : " 🔺";
    return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — ${val} (em ${r.games} jogos)${badge}`;
  });

  return interaction.reply([title, ...lines].join("\n"));
}

async function topMyChampions(interaction) {
  const link = db.prepare("SELECT puuid FROM user_links WHERE discord_id = ?").get(interaction.user.id);
  if (!link) {
    return interaction.reply({ content: "Você não está linkado. Use `/link me Nome#TAG` primeiro.", ephemeral: true });
  }

  const rows = db.prepare(`
    SELECT
      pms.champion_name AS champion,
      COUNT(*) AS games
    FROM player_match_stats pms
    JOIN matches m ON m.match_id = pms.match_id
    WHERE pms.puuid = ?
      AND pms.champion_name IS NOT NULL
      AND pms.champion_name != ''
      AND m.queue_id NOT IN ${BOT_QUEUES}
    GROUP BY pms.champion_name
    ORDER BY games DESC, champion ASC
    LIMIT 3
  `).all(link.puuid);

  if (rows.length === 0) {
    return interaction.reply({ content: "Sem dados suficientes ainda. Rode `/update me`.", ephemeral: true });
  }

  const nameRow = db.prepare(`
    SELECT riot_game_name, riot_tag_line FROM riot_accounts WHERE puuid = ?
  `).get(link.puuid);

  const playerName = nameRow ? `${nameRow.riot_game_name}#${nameRow.riot_tag_line}` : "Você";

  const lines = rows.map((r, idx) => fmtLine(idx + 1, playerName, r.champion, r.games));
  return interaction.reply([`🏅 Top 3 campeões mais jogados de **${playerName}**`, ...lines].join("\n"));
}

async function topChampsGlobal(interaction) {
  // Top 1 champ por player, rankeando pelo maior "games" no mesmo champ
  // Requer SQLite com window function (ok nas versões atuais)
  const rows = db.prepare(`
    WITH champ_counts AS (
      SELECT
        pms.puuid,
        pms.champion_name AS champion,
        COUNT(*) AS games
      FROM player_match_stats pms
      JOIN matches m ON m.match_id = pms.match_id
      WHERE pms.champion_name IS NOT NULL
        AND pms.champion_name != ''
        AND m.queue_id NOT IN ${BOT_QUEUES}
      GROUP BY pms.puuid, pms.champion_name
    ),
    ranked AS (
      SELECT
        puuid, champion, games,
        ROW_NUMBER() OVER (PARTITION BY puuid ORDER BY games DESC, champion ASC) AS rn
      FROM champ_counts
    )
    SELECT
      ra.riot_game_name, ra.riot_tag_line,
      ranked.champion,
      ranked.games,
      ul.discord_id AS claimed_discord_id
    FROM ranked
    JOIN riot_accounts ra ON ra.puuid = ranked.puuid
    LEFT JOIN user_links ul ON ul.puuid = ranked.puuid
    WHERE ranked.rn = 1
    ORDER BY ranked.games DESC, ra.riot_game_name ASC
    LIMIT 20
  `).all();

  if (rows.length === 0) return interaction.reply("Sem dados ainda. Use `/link add`/`/link me` e rode updates.");

  const lines = rows.map((r, idx) => {
    const badge = r.claimed_discord_id ? "" : " 🔺";
    const player = `${r.riot_game_name}#${r.riot_tag_line}${badge}`;
    return fmtLine(idx + 1, player, r.champion, r.games);
  });

  return interaction.reply(["🏆 Campeão mais jogado de cada pessoa (rank por mono de guerra)", ...lines].join("\n"));
}

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (!group) {
    if (sub === "kills" || sub === "deaths" || sub === "assists") {
      return rankTotals(interaction, sub);
    }
  }

  if (group === "top") {
    if (sub === "my_champions") return topMyChampions(interaction);
    if (sub === "champs") return topChampsGlobal(interaction);
  }

  return interaction.reply({ content: "Comando inválido.", ephemeral: true });
}