import "dotenv/config";
import { REST, Routes } from "discord.js";

import * as ping from "./commands/ping.js";
import * as key from "./commands/key.js";
import * as link from "./commands/link.js";
import * as update from "./commands/update.js";
import * as rank from "./commands/rank.js";

const commands = [ping, key, link, update, rank].map(c => c.data);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!clientId || !guildId) {
  throw new Error("Faltou DISCORD_CLIENT_ID ou DISCORD_GUILD_ID no .env");
}

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands }
);

console.log("✅ Slash commands registrados no servidor.");