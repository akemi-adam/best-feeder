export const data = {
  name: "ping",
  description: "Testa se o bot está vivo.",
};

export async function execute(interaction) {
  await interaction.reply("pong 🏓");
}