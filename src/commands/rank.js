import { db } from "../db/db.js";

const BOT_QUEUES = "(870, 880, 890)";

const MONTHS = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};

export const data = {
  name: "rank",
  description: "Rankings zueiros e tops de campeões.",
  options: [
    {
      type: 1,
      name: "kills",
      description: "🔪 Top Açougue (total kills)",
      options: [
        {
          type: 3,
          name: "month",
          description: "Ex: january, february, march...",
          required: false
        },
        {
          type: 3,
          name: "period",
          description: "today | last30days",
          required: false,
          choices: [
            { name: "today", value: "today" },
            { name: "last30days", value: "last30days" }
          ]
        }
      ]
    },
    {
      type: 1,
      name: "deaths",
      description: "💀 Top Cemitério (total deaths)",
      options: [
        {
          type: 3,
          name: "month",
          description: "Ex: january, february, march...",
          required: false
        },
        {
          type: 3,
          name: "period",
          description: "today | last30days",
          required: false,
          choices: [
            { name: "today", value: "today" },
            { name: "last30days", value: "last30days" }
          ]
        }
      ]
    },
    {
      type: 1,
      name: "assists",
      description: "🛟 Top Playmaker (total assists)",
      options: [
        {
          type: 3,
          name: "month",
          description: "Ex: january, february, march...",
          required: false
        },
        {
          type: 3,
          name: "period",
          description: "today | last30days",
          required: false,
          choices: [
            { name: "today", value: "today" },
            { name: "last30days", value: "last30days" }
          ]
        }
      ]
    },
  ]
};

function fmtLine(i, player, champ, games) {
  return `${i}. **${player}** — **${champ}** (${games} jogos)`;
}

async function rankTotals(interaction, metric) {
  const monthInput = interaction.options.getString("month");
  const periodInput = interaction.options.getString("period");

  const titleBase =
    metric === "kills" ? "🔪 Top Açougue" :
    metric === "assists" ? "🛟 Top Carregado" :
    "💀 Top Cemitério";

  const metricCol =
    metric === "kills" ? "SUM(pms.kills)" :
    metric === "assists" ? "SUM(pms.assists)" :
    "SUM(pms.deaths)";

  let whereExtra = "";
  let params = [];

  // 🔥 PRIORIDADE: period > month > global

  if (periodInput === "today") {
    whereExtra = `
      AND date(m.game_start_ts / 1000, 'unixepoch')
        = date('now')
    `;
  }

  if (periodInput === "last30days") {
    whereExtra = `
      AND m.game_start_ts >= (strftime('%s','now','-30 days') * 1000)
    `;
  }

  if (!periodInput && monthInput) {
    const monthNumber = MONTHS[monthInput.toLowerCase()];
    if (!monthNumber)
      return interaction.reply({ content: "Mês inválido.", ephemeral: true });

    whereExtra = `
      AND strftime('%m', m.game_start_ts / 1000, 'unixepoch') = ?
    `;
    params.push(monthNumber);
  }

  // ✅ Se não tem filtro → usa aggregates
  if (!periodInput && !monthInput) {
    const col =
      metric === "kills" ? "a.total_kills" :
      metric === "assists" ? "a.total_assists" :
      "a.total_deaths";

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

    if (rows.length === 0)
      return interaction.reply("Sem dados ainda.");

    const lines = rows.map((r, idx) => {
      const val =
        metric === "kills" ? r.total_kills :
        metric === "assists" ? r.total_assists :
        r.total_deaths;

      const badge = r.claimed_discord_id ? "" : " 🔺";
      return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — ${val} (em ${r.games} jogos)${badge}`;
    });

    return interaction.reply([titleBase, ...lines].join("\n"));
  }

  // 🔥 Cálculo dinâmico (month ou period)
  const rows = db.prepare(`
    SELECT
      ra.riot_game_name, ra.riot_tag_line,
      COUNT(pms.match_id) AS games,
      COALESCE(${metricCol},0) AS total,
      ul.discord_id AS claimed_discord_id
    FROM riot_accounts ra
    JOIN player_match_stats pms ON pms.puuid = ra.puuid
    JOIN matches m ON m.match_id = pms.match_id
    LEFT JOIN user_links ul ON ul.puuid = ra.puuid
    WHERE m.queue_id NOT IN ${BOT_QUEUES}
      ${whereExtra}
    GROUP BY ra.puuid
    ORDER BY total DESC
    LIMIT 10
  `).all(...params);

  if (rows.length === 0)
    return interaction.reply("Sem dados para esse período.");

  const periodLabel =
    periodInput === "today" ? " — hoje" :
    periodInput === "last30days" ? " — últimos 30 dias" :
    monthInput ? ` — ${monthInput}` :
    "";

  const lines = rows.map((r, idx) => {
    const badge = r.claimed_discord_id ? "" : " 🔺";
    return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — ${r.total} (em ${r.games} jogos)${badge}`;
  });

  return interaction.reply(
    [`${titleBase}${periodLabel}`, ...lines].join("\n")
  );
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