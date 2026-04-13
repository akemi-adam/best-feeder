import { db } from "../db/db.js";

const BOT_QUEUES = "(870, 880, 890)";

export const data = {
  name: "winrate",
  description: "Mostra winrates por lane.",
  options: [
    {
      type: 1,
      name: "me",
      description: "Mostra sua winrate em cada lane.",
    },
    {
      type: 1,
      name: "global",
      description: "Mostra o winrate geral de cada pessoa, em ranking global.",
      options: [
        {
          type: 3,
          name: "mode",
          description: "Filtro por modo de jogo",
          required: false,
          choices: [
            { name: "normal", value: "normal" },
            { name: "solo/duo", value: "solo_duo" },
            { name: "flex", value: "flex" },
            { name: "aram", value: "aram" }
          ]
        },
        {
          type: 3,
          name: "month",
          description: "Ex: january, february, march...",
          required: false,
          choices: [
            { name: "january", value: "january" },
            { name: "february", value: "february" },
            { name: "march", value: "march" },
            { name: "april", value: "april" },
            { name: "may", value: "may" },
            { name: "june", value: "june" },
            { name: "july", value: "july" },
            { name: "august", value: "august" },
            { name: "september", value: "september" },
            { name: "october", value: "october" },
            { name: "november", value: "november" },
            { name: "december", value: "december" }
          ]
        }
      ]
    },
    {
      type: 1,
      name: "lane",
      description: "Mostra o ranking global de winrate em uma lane específica.",
      options: [
        {
          type: 3,
          name: "name",
          description: "Lane: top, jungle, mid, adc, support",
          required: true,
          choices: [
            { name: "top", value: "TOP" },
            { name: "jungle", value: "JUNGLE" },
            { name: "mid", value: "MIDDLE" },
            { name: "adc", value: "ADC" },
            { name: "support", value: "SUPPORT" }
            ]
        }
      ]
    }
  ]
};

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

const MODE_QUEUES = {
  normal: [400, 430, 490],
  solo_duo: [420],
  flex: [440],
  aram: [450],
};

function modeLabel(mode) {
  switch (mode) {
    case "normal": return "Normal";
    case "solo_duo": return "Solo/Duo";
    case "flex": return "Flex";
    case "aram": return "ARAM";
    default: return "Todos os modos";
  }
}

function laneLabel(lane) {
  switch (lane) {
    case "TOP": return "🛡️ Top";
    case "JUNGLE": return "🌿 Jungle";
    case "MIDDLE": return "✨ Mid";
    case "ADC": return "🏹 ADC";
    case "SUPPORT": return "💖 Support";
    default: return lane || "Desconhecida";
  }
}

function shortLaneLabel(lane) {
  switch (lane) {
    case "TOP": return "Top";
    case "JUNGLE": return "Jungle";
    case "MIDDLE": return "Mid";
    case "ADC": return "ADC";
    case "SUPPORT": return "Support";
    default: return lane || "Unknown";
  }
}

function formatWinrate(wins, losses) {
  const total = wins + losses;
  if (total === 0) return "0.0% (0W - 0L)";
  const wr = ((wins / total) * 100).toFixed(1);
  return `${wr}% (${wins}W - ${losses}L)`;
}

async function winrateMe(interaction) {
  const link = db.prepare(`
    SELECT puuid
    FROM user_links
    WHERE discord_id = ?
  `).get(interaction.user.id);

  if (!link) {
    return interaction.reply({
      content: "Você não está linkado. Use `/link me Nome#TAG` primeiro.",
      ephemeral: true
    });
  }

  const player = db.prepare(`
    SELECT riot_game_name, riot_tag_line
    FROM riot_accounts
    WHERE puuid = ?
  `).get(link.puuid);

  const rows = db.prepare(`
    WITH classified AS (
      SELECT
        CASE
          WHEN pms.role = 'SUPPORT' THEN 'SUPPORT'
          WHEN pms.lane = 'TOP' THEN 'TOP'
          WHEN pms.lane = 'JUNGLE' THEN 'JUNGLE'
          WHEN pms.lane = 'MIDDLE' THEN 'MIDDLE'
          WHEN pms.lane = 'BOTTOM' THEN 'ADC'
          ELSE NULL
        END AS lane_group,
        pms.win
      FROM player_match_stats pms
      JOIN matches m ON m.match_id = pms.match_id
      WHERE pms.puuid = ?
        AND m.queue_id NOT IN ${BOT_QUEUES}
    )
    SELECT
      lane_group AS lane,
      SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN win = 0 THEN 1 ELSE 0 END) AS losses,
      COUNT(*) AS games
    FROM classified
    WHERE lane_group IS NOT NULL
    GROUP BY lane_group
  `).all(link.puuid);

  const byLane = {
    TOP: { wins: 0, losses: 0, games: 0 },
    JUNGLE: { wins: 0, losses: 0, games: 0 },
    MIDDLE: { wins: 0, losses: 0, games: 0 },
    ADC: { wins: 0, losses: 0, games: 0 },
    SUPPORT: { wins: 0, losses: 0, games: 0 },
  };

  for (const r of rows) {
    byLane[r.lane] = {
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      games: r.games ?? 0,
    };
  }

  const orderedLanes = ["TOP", "JUNGLE", "MIDDLE", "ADC", "SUPPORT"];

  const lines = orderedLanes.map((lane) => {
    const r = byLane[lane];
    return `• ${laneLabel(lane)} — **${formatWinrate(r.wins, r.losses)}**`;
  });

  return interaction.reply([
    `📊 Winrate por lane de **${player.riot_game_name}#${player.riot_tag_line}**`,
    ...lines
  ].join("\n"));
}

async function winrateGlobal(interaction) {
  const mode = interaction.options.getString("mode", false);
  const monthInput = interaction.options.getString("month", false);

  let whereClauses = [`m.queue_id NOT IN ${BOT_QUEUES}`];
  let params = [];

  if (mode) {
    const queues = MODE_QUEUES[mode];
    if (!queues || queues.length === 0) {
      return interaction.reply({ content: "Modo inválido.", ephemeral: true });
    }

    whereClauses.push(`m.queue_id IN (${queues.map(() => "?").join(", ")})`);
    params.push(...queues);
  }

  if (monthInput) {
    const monthNumber = MONTHS[monthInput.toLowerCase()];
    if (!monthNumber) {
      return interaction.reply({ content: "Mês inválido.", ephemeral: true });
    }

    whereClauses.push(`strftime('%m', m.game_start_ts / 1000, 'unixepoch') = ?`);
    params.push(monthNumber);
  }

  const whereSql = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  const rows = db.prepare(`
    SELECT
      ra.riot_game_name,
      ra.riot_tag_line,
      SUM(CASE WHEN pms.win = 1 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN pms.win = 0 THEN 1 ELSE 0 END) AS losses,
      COUNT(*) AS games,
      (SUM(CASE WHEN pms.win = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) AS winrate,
      ul.discord_id AS claimed_discord_id
    FROM player_match_stats pms
    JOIN matches m ON m.match_id = pms.match_id
    JOIN riot_accounts ra ON ra.puuid = pms.puuid
    LEFT JOIN user_links ul ON ul.puuid = pms.puuid
    ${whereSql}
    GROUP BY pms.puuid
    ORDER BY winrate DESC, games DESC, wins DESC, ra.riot_game_name ASC
    LIMIT 20
  `).all(...params);

  if (rows.length === 0) {
    const parts = [];
    if (mode) parts.push(modeLabel(mode));
    if (monthInput) parts.push(monthInput);
    const label = parts.length ? ` para **${parts.join(" / ")}**` : "";
    return interaction.reply(`Sem dados suficientes ainda${label}.`);
  }

  const scopeParts = [];
  if (mode) scopeParts.push(modeLabel(mode));
  if (monthInput) scopeParts.push(monthInput);
  const scopeLabel = scopeParts.length ? ` — **${scopeParts.join(" / ")}**` : "";

  const lines = rows.map((r, idx) => {
    const badge = r.claimed_discord_id ? "" : " 🔺";
    return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — **${formatWinrate(r.wins, r.losses)}**${badge}`;
  });

  return interaction.reply([
    `🏆 Winrate global${scopeLabel}`,
    ...lines
  ].join("\n"));
}

async function winrateByLane(interaction) {
  const lane = interaction.options.getString("name", true);

  const rows = db.prepare(`
    WITH classified AS (
      SELECT
        pms.puuid,
        CASE
          WHEN pms.role = 'SUPPORT' THEN 'SUPPORT'
          WHEN pms.lane = 'TOP' THEN 'TOP'
          WHEN pms.lane = 'JUNGLE' THEN 'JUNGLE'
          WHEN pms.lane = 'MIDDLE' THEN 'MIDDLE'
          WHEN pms.lane = 'BOTTOM' THEN 'ADC'
          ELSE NULL
        END AS lane_group,
        pms.win
      FROM player_match_stats pms
      JOIN matches m ON m.match_id = pms.match_id
      WHERE m.queue_id NOT IN ${BOT_QUEUES}
    )
    SELECT
      ra.riot_game_name,
      ra.riot_tag_line,
      SUM(CASE WHEN c.win = 1 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN c.win = 0 THEN 1 ELSE 0 END) AS losses,
      COUNT(*) AS games,
      (SUM(CASE WHEN c.win = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) AS winrate,
      ul.discord_id AS claimed_discord_id
    FROM classified c
    JOIN riot_accounts ra ON ra.puuid = c.puuid
    LEFT JOIN user_links ul ON ul.puuid = c.puuid
    WHERE c.lane_group = ?
    GROUP BY c.puuid
    ORDER BY winrate DESC, games DESC, wins DESC, ra.riot_game_name ASC
    LIMIT 20
  `).all(lane);

  if (rows.length === 0) {
    return interaction.reply(`Sem dados suficientes para a lane **${shortLaneLabel(lane)}**.`);
  }

  const lines = rows.map((r, idx) => {
    const badge = r.claimed_discord_id ? "" : " 🔺";
    return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — **${formatWinrate(r.wins, r.losses)}**${badge}`;
  });

  return interaction.reply([
    `📈 Winrate global na lane **${shortLaneLabel(lane)}**`,
    ...lines
  ].join("\n"));
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "me") return winrateMe(interaction);
  if (sub === "global") return winrateGlobal(interaction);
  if (sub === "lane") return winrateByLane(interaction);

  return interaction.reply({ content: "Comando inválido.", ephemeral: true });
}