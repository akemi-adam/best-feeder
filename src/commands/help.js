export const data = {
  name: "help",
  description: "Mostra um tutorial rápido de como usar o bot.",
};

export async function execute(interaction) {
  const text =
`📘 **Como usar o BestFeeder (LoL Stats Zueiras)**

━━━━━━━━━━━━━━━━━━━━━━
🔐 1) Configurar a Riot Key (apenas admin)
• \`/key set SUA_RIOT_KEY\`
• \`/key test\`

━━━━━━━━━━━━━━━━━━━━━━
👤 2) Vincular contas Riot

🔹 Vincular SEU Discord:
• \`/link me Nome#TAG\`
Ex: \`/link me Ganest11#GPS\`

🔹 Pré-cadastrar alguém (admin):
• \`/link add Nome#TAG\`

✅ Ao vincular, o bot já puxa automaticamente **as últimas 20 partidas**.
Se as partidas já estiverem no banco, ele não baixa novamente.

━━━━━━━━━━━━━━━━━━━━━━
🔄 3) Atualizar partidas manualmente
• \`/update\` → puxa 20 partidas
• \`/update 50\` → puxa até 50 partidas

(O bot só baixa partidas novas que ainda não existem no banco.)

━━━━━━━━━━━━━━━━━━━━━━
🏆 4) Rankings zueiros
• \`/rank deaths\` → 💀 Top Cemitério
• \`/rank kills\` → 🔪 Top Açougue
• \`/rank assists\` → 🛟 Top Carregado

ℹ️ O ranking mostra todos os jogadores cadastrados.
Se alguém aparecer como *(não claimado)*, significa que ainda não rodou \`/link me\`.

━━━━━━━━━━━━━━━━━━━━━━
🔥 Fluxo recomendado:
1. Admin roda \`/link add\` para todo mundo.
2. Cada pessoa roda \`/link me\`.
3. Atualizem quando quiserem zoar alguém.
`;

  await interaction.reply({ content: text, ephemeral: true });
}