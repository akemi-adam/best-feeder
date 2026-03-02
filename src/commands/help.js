export const data = {
  name: "help",
  description: "Mostra um tutorial rápido de como usar o bot.",
};

export async function execute(interaction) {
  const text =
`📘 **Como usar o BestFeeder (LoL Stats Zueiras)**

1) **Configurar a Riot Key (apenas admin)**
• \`/key set SUA_RIOT_KEY\`
• \`/key test\`

2) **Linkar sua conta Riot**
• \`/link Nome#TAG\`
Ex: \`/link Ganest11#GPS\`

✅ Ao linkar, o bot já puxa automaticamente **as últimas 20 partidas**.

3) **Atualizar novamente quando quiser**
• \`/update\` (puxa 20)
• \`/update 50\` (puxa até 50)

4) **Rankings zueiros**
• \`/rank deaths\` → 💀 Top Cemitério
• \`/rank kills\` → 🔪 Top Açougue
• \`/rank assists\` → 🛟 Top Carregado

Dica: se alguém não aparece no ranking, é porque ainda não linkou (\`/link\`) ou não atualizou (\`/update\`).`;

  await interaction.reply({ content: text, ephemeral: true });
}