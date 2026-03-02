import { db } from "../db/db.js";
import { parseRiotId } from "../riot/parse.js";
import { getAccountByRiotId } from "../riot/client.js";
import { updateRecentMatchesForPuuid } from "../services/updatePlayer.js";

export const data = {
  name: "link",
  description: "Vincula Riot IDs no bot.",
  options: [
    {
      type: 1,
      name: "me",
      description: "Vincula SEU Discord ao seu Riot ID (Nome#TAG).",
      options: [
        { type: 3, name: "riotid", description: "Ex: Ganest11#GPS", required: true }
      ]
    },
    {
      type: 1,
      name: "add",
      description: "Pré-cadastra um Riot ID (admin) e já baixa as últimas 20 partidas.",
      options: [
        { type: 3, name: "riotid", description: "Ex: Fulano#BR1", required: true }
      ]
    }
  ]
};

// Se quiser travar só pra você, coloque seu ID aqui.
const ADMIN_IDS = new Set([
  // "123456789012345678"
]);

function upsertRiotAccount(puuid, gameName, tagLine) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO riot_accounts(puuid, riot_game_name, riot_tag_line, created_at)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(puuid) DO UPDATE SET
      riot_game_name=excluded.riot_game_name,
      riot_tag_line=excluded.riot_tag_line
  `).run(puuid, gameName, tagLine, now);
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const riotid = interaction.options.getString("riotid", true);

  const parsed = parseRiotId(riotid);
  if (!parsed) {
    return interaction.reply({ content: "Formato inválido. Use `Nome#TAG`.", ephemeral: true });
  }

  // /link add (admin)
  if (sub === "add") {
    if (ADMIN_IDS.size > 0 && !ADMIN_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "Sem permissão pra usar `/link add` 😅", ephemeral: true });
    }

    await interaction.reply(`Adicionando **${parsed.gameName}#${parsed.tagLine}** e puxando 20 partidas...`);

    try {
      const acc = await getAccountByRiotId(parsed.gameName, parsed.tagLine);

      upsertRiotAccount(acc.puuid, parsed.gameName, parsed.tagLine);

      const result = await updateRecentMatchesForPuuid(acc.puuid, 20);

      return interaction.editReply(
        `✅ Pré-cadastrado: **${parsed.gameName}#${parsed.tagLine}**\n` +
        `📦 Update: baixei **${result.fetched}**, pulei **${result.skipped}** (de ${result.total}).\n` +
        `ℹ️ Quando a pessoa rodar \`/link me ${parsed.gameName}#${parsed.tagLine}\`, o bot só associa o Discord dela ao mesmo player.`
      );
    } catch (e) {
      return interaction.editReply(`Erro ao adicionar: ${e.message}`);
    }
  }

  // /link me (usuário se associa)
  await interaction.reply(`Vinculando **${parsed.gameName}#${parsed.tagLine}** ao seu Discord e puxando 20 partidas...`);

  try {
    // Primeiro tenta achar por RiotID no banco (já pré-cadastrado)
    const existing = db.prepare(`
      SELECT puuid FROM riot_accounts
      WHERE riot_game_name = ? AND riot_tag_line = ?
    `).get(parsed.gameName, parsed.tagLine);

    let puuid = existing?.puuid;

    // Se não existe, consulta a Riot e cria
    if (!puuid) {
      const acc = await getAccountByRiotId(parsed.gameName, parsed.tagLine);
      puuid = acc.puuid;
      upsertRiotAccount(puuid, parsed.gameName, parsed.tagLine);
    }

    // Faz o link Discord -> puuid
    db.prepare(`
      INSERT INTO user_links(discord_id, puuid, created_at)
      VALUES(?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET puuid=excluded.puuid
    `).run(interaction.user.id, puuid, Date.now());

    // Update automático 20
    const result = await updateRecentMatchesForPuuid(puuid, 20);

    return interaction.editReply(
      `✅ Vinculado: **${parsed.gameName}#${parsed.tagLine}**\n` +
      `📦 Update automático: baixei **${result.fetched}**, pulei **${result.skipped}** (de ${result.total}).`
    );
  } catch (e) {
    return interaction.editReply(`Erro ao vincular: ${e.message}`);
  }
}