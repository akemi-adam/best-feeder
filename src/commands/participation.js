import { db } from "../db/db.js";

const BOT_QUEUES = [870, 880, 890];

export const data = {
  name: "participation",
  description: "Mostra quem mais/menos aparece no universo de partidas salvas.",
  options: [
    { type: 1, name: "most", description: "Quem mais aparece (maior presença)." },
    { type: 1, name: "least", description: "Quem menos aparece (menor presença)." },
  ]
};

function pctStr(pct) {
  return pct.toFixed(pct >= 10 ? 1 : 2);
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  // Total de partidas únicas salvas, ignorando bots
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM matches
    WHERE queue_id NOT IN (${BOT_QUEUES.join(",")})
  `).get();

  const totalMatches = totalRow?.total ?? 0;

  if (totalMatches === 0) {
    return interaction.reply(
      "Ainda não tenho partidas PvP suficientes salvas 😶\nUse `/update global` ou `/link me` + `/update me`."
    );
  }

  // Presença por player (quantos matches únicos aparecem)
  // LEFT JOIN pra quem ainda não tem stats cair como 0
  const rows = db.prepare(`
    SELECT
      ra.puuid,
      ra.riot_game_name,
      ra.riot_tag_line,
      COALESCE(COUNT(DISTINCT pms.match_id), 0) AS present_matches,
      ul.discord_id AS claimed_discord_id
    FROM riot_accounts ra
    LEFT JOIN user_links ul ON ul.puuid = ra.puuid
    LEFT JOIN player_match_stats pms ON pms.puuid = ra.puuid
    LEFT JOIN matches m ON m.match_id = pms.match_id
      AND m.queue_id NOT IN (${BOT_QUEUES.join(",")})
    GROUP BY ra.puuid
  `).all();

  if (rows.length === 0) {
    return interaction.reply(
      "Eu tenho partidas salvas, mas ainda não tenho ninguém cadastrado em `riot_accounts` 😵‍💫\nUse `/link add`."
    );
  }

  // Escolhe o campeão da presença (most) ou o fantasma (least)
  let chosen;
  if (sub === "most") {
    chosen = rows.reduce((best, r) => (r.present_matches > best.present_matches ? r : best), rows[0]);
  } else {
    chosen = rows.reduce((best, r) => (r.present_matches < best.present_matches ? r : best), rows[0]);
  }

  const present = chosen.present_matches ?? 0;
  const pct = (present / totalMatches) * 100;

  const badge = chosen.claimed_discord_id ? "" : " 🔺";
  const name = `${chosen.riot_game_name}#${chosen.riot_tag_line}${badge}`;

  if (sub === "most") {
    let vibe = "✨ presença lendária";
    if (pct >= 80) vibe = "👑 onipresente (quase onisciente)";
    else if (pct >= 60) vibe = "🧲 ímã de time (sempre tá junto)";
    else if (pct >= 40) vibe = "🤝 companheiro(a) de jornada";
    else if (pct >= 20) vibe = "🌱 aparece de vez em quando";
    else vibe = "👻 avistamentos raros";

    return interaction.reply(
      `📌 **Quem mais aparece nos jogos do universo salvo:**\n` +
      `🥇 **${name}** — **${pctStr(pct)}%** de presença (${present}/${totalMatches})\n` +
      `💖 Status: **${vibe}**`
    );
  }

  // least
  let vibe = "👻 lenda urbana";
  if (pct === 0) vibe = "🫥 literalmente não foi visto";
  else if (pct <= 5) vibe = "🦉 rara aparição";
  else if (pct <= 15) vibe = "🍃 passa como vento";
  else if (pct <= 30) vibe = "🐢 sempre chega depois";
  else vibe = "😅 até aparece, mas some";

  return interaction.reply(
    `📌 **Quem menos aparece nos jogos do universo salvo:**\n` +
    `🥉 **${name}** — **${pctStr(pct)}%** de presença (${present}/${totalMatches})\n` +
    `🫶 Status: **${vibe}**`
  );
}