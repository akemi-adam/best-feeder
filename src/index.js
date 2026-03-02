import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { initDb } from "./db/db.js";

import * as ping from "./commands/ping.js";
import * as key from "./commands/key.js";
import * as link from "./commands/link.js";
import * as update from "./commands/update.js";
import * as rank from "./commands/rank.js";
import * as help from "./commands/help.js";
import * as participation from "./commands/participation.js";

initDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
for (const cmd of [ping, help, key, link, update, rank, participation]) {
  client.commands.set(cmd.data.name, cmd);
}

client.on("ready", () => {
  console.log(`✅ Logado como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `Erro: ${e.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Erro: ${e.message}`, ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);