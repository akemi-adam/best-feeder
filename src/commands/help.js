export const data = {
  name: "help",
  description: "Mostra um tutorial rápido de como usar o bot.",
};

export async function execute(interaction) {
const text =
`📘 **Como usar o BestFeeder**

🔐 **1) Riot Key (admin)**
• \`/key set SUA_RIOT_KEY\`
• \`/key test\`

👤 **2) Vincular contas**
• \`/link me Nome#TAG\`
Ex: \`/link me Ganest11#GPS\`

• \`/link add Nome#TAG\` *(admin)*

✅ Ao linkar, o bot já puxa automaticamente as últimas 20 partidas.

🔄 **3) Atualizar partidas**
• \`/update me\`
• \`/update me count:50\`

🌍 Global *(admin)*
• \`/update global\`
• \`/update global count:50\`

🏆 **4) Ranks**
• \`/rank kills\`
• \`/rank deaths\`
• \`/rank assists\`

📅 Filtros:
• \`/rank kills month:march\`
• \`/rank kills period:last30days\`
• \`/rank kills period:today\`

🥇 **5) Top champs**
• \`/rank top my_champions\`
• \`/rank top champs\`

📊 **6) Participation**
• \`/participation most\`
• \`/participation least\`

📈 **7) Winrate**
• \`/winrate me\`
• \`/winrate global\`
• \`/winrate global mode:flex\`
• \`/winrate global month:april\`
• \`/winrate lane name:top\`

🧠 **8) Build**
• \`/build champ:fiddlesticks lane:top\`
• \`/build champ:sona lane:jungle\`

💡 **Dicas**
• 🔺 = não claimado
• Bots não entram nos ranks
• Alguns modos novos podem não aparecer na Riot API`;

  await interaction.reply({ content: text, ephemeral: true });
}