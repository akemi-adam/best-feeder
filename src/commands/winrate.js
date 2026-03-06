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
      description: "Mostra o melhor winrate/lane de cada pessoa, em ranking global.",
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
    ),
    lane_stats AS (
      SELECT
        puuid,
        lane_group AS lane,
        SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN win = 0 THEN 1 ELSE 0 END) AS losses,
        COUNT(*) AS games,
        (SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) AS winrate
      FROM classified
      WHERE lane_group IS NOT NULL
      GROUP BY puuid, lane_group
      HAVING COUNT(*) >= 1
    ),
    ranked AS (
      SELECT
        ls.*,
        ROW_NUMBER() OVER (
          PARTITION BY ls.puuid
          ORDER BY ls.winrate DESC, ls.games DESC, ls.wins DESC, ls.lane ASC
        ) AS rn
      FROM lane_stats ls
    )
    SELECT
      ra.riot_game_name,
      ra.riot_tag_line,
      ranked.lane,
      ranked.wins,
      ranked.losses,
      ranked.games,
      ranked.winrate,
      ul.discord_id AS claimed_discord_id
    FROM ranked
    JOIN riot_accounts ra ON ra.puuid = ranked.puuid
    LEFT JOIN user_links ul ON ul.puuid = ranked.puuid
    WHERE ranked.rn = 1
    ORDER BY ranked.winrate DESC, ranked.games DESC, ranked.wins DESC, ra.riot_game_name ASC
    LIMIT 20
  `).all();

  if (rows.length === 0) {
    return interaction.reply("Sem dados suficientes ainda. Rode `/update global`.");
  }

  const lines = rows.map((r, idx) => {
    const badge = r.claimed_discord_id ? "" : " 🔺";
    return `${idx + 1}. **${r.riot_game_name}#${r.riot_tag_line}** — ${shortLaneLabel(r.lane)} — **${formatWinrate(r.wins, r.losses)}**${badge}`;
  });

  return interaction.reply([
    "🏆 Melhor winrate por pessoa (melhor lane de cada um)",
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