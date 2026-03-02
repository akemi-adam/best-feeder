import { db } from "../db/db.js";
import { updateRecentMatchesForPuuid } from "../services/updatePlayer.js";

export const data = {
  name: "update",
  description: "Atualiza suas estatísticas puxando as últimas partidas.",
  options: [
    { type: 4, name: "count", description: "Quantas partidas (default 20)", required: false }
  ]
};

export async function execute(interaction) {
  const count = interaction.options.getInteger("count") ?? 20;

  const player = db.prepare("SELECT puuid FROM players WHERE discord_id = ?").get(interaction.user.id);
  if (!player) return interaction.reply({ content: "Você não está linkado. Use `/link Nome#TAG`.", ephemeral: true });

  await interaction.reply(`Atualizando últimas **${count}** partidas...`);

  try {
    const result = await updateRecentMatchesForPuuid(player.puuid, count);
    return interaction.editReply(
      `✅ Update concluído. Baixei **${result.fetched}**, pulei **${result.skipped}** (de ${result.total}).`
    );
  } catch (e) {
    return interaction.editReply(`❌ Erro no update: ${e.message}`);
  }
}