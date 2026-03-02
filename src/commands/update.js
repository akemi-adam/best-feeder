import { db } from "../db/db.js";
import { updateRecentMatchesForPuuid } from "../services/updatePlayer.js";

export const data = {
  name: "update",
  description: "Atualiza estatísticas puxando partidas recentes.",
  options: [
    {
      type: 1,
      name: "me",
      description: "Atualiza suas estatísticas (conta linkada).",
      options: [
        { type: 4, name: "count", description: "Quantas partidas (default 20)", required: false }
      ]
    },
    {
      type: 1,
      name: "global",
      description: "Atualiza TODO MUNDO (linkado ou não). (admin)",
      options: [
        { type: 4, name: "count", description: "Quantas partidas por pessoa (default 20)", required: false }
      ]
    }
  ]
};

// Se quiser travar só pra você, coloque seu ID aqui.
const ADMIN_IDS = new Set([
  // "123456789012345678"
]);

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const count = interaction.options.getInteger("count") ?? 20;

  // /update me
  if (sub === "me") {
    const player = db
      .prepare("SELECT puuid FROM user_links WHERE discord_id = ?")
      .get(interaction.user.id);

    if (!player) {
      return interaction.reply({ content: "Você não está linkado. Use `/link me Nome#TAG`.", ephemeral: true });
    }

    await interaction.reply(`Atualizando suas últimas **${count}** partidas...`);

    try {
      const result = await updateRecentMatchesForPuuid(player.puuid, count);
      return interaction.editReply(
        `✅ Update (me) concluído. Baixei **${result.fetched}**, pulei **${result.skipped}** (de ${result.total}).`
      );
    } catch (e) {
      return interaction.editReply(`❌ Erro no update: ${e.message}`);
    }
  }

  // /update global
  if (sub === "global") {
    if (ADMIN_IDS.size > 0 && !ADMIN_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "Sem permissão pra usar `/update global` 😅", ephemeral: true });
    }

    const accounts = db.prepare(`
      SELECT puuid, riot_game_name, riot_tag_line
      FROM riot_accounts
      ORDER BY created_at ASC
    `).all();

    if (accounts.length === 0) {
      return interaction.reply("Não tem ninguém em `riot_accounts` ainda. Use `/link add` ou `/link me`.");
    }

    await interaction.reply(
      `🌍 Update global iniciado: **${accounts.length}** jogadores × **${count}** partidas.\n` +
      `Vou baixar só partidas novas (match repetido é ignorado).`
    );

    let totalFetched = 0;
    let totalSkipped = 0;
    let ok = 0;
    let fail = 0;

    // Se quiser, pode editar status a cada X jogadores
    const EDIT_EVERY = 3;

    for (let i = 0; i < accounts.length; i++) {
      const a = accounts[i];
      try {
        const r = await updateRecentMatchesForPuuid(a.puuid, count);
        totalFetched += r.fetched;
        totalSkipped += r.skipped;
        ok++;
      } catch (e) {
        fail++;
      }

      if ((i + 1) % EDIT_EVERY === 0 || i === accounts.length - 1) {
        await interaction.editReply(
          `🌍 Update global em andamento: **${i + 1}/${accounts.length}**\n` +
          `📥 Baixadas (novas): **${totalFetched}** | ⏭️ Puladas (já no DB): **${totalSkipped}**\n` +
          `✅ OK: **${ok}** | ❌ Falhas: **${fail}**`
        );
      }
    }

    return; // já finalizamos com editReply
  }
}