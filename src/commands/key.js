import { setConfig, getConfig } from "../db/db.js";
import { request } from "undici";

export const data = {
  name: "key",
  description: "Configura e testa a Riot API Key.",
  options: [
    {
      type: 1,
      name: "set",
      description: "Define a Riot API Key (admin).",
      options: [
        { type: 3, name: "value", description: "Cole sua Riot API Key", required: true }
      ]
    },
    {
      type: 1,
      name: "test",
      description: "Testa a Riot API Key atual.",
    }
  ]
};

// Coloque seu Discord userId aqui pra restringir (ou troque por checagem de cargo)
const ADMIN_IDS = new Set([
  // "123456789012345678"
]);

async function testKey(apiKey) {
  // endpoint simples: status do LoL (plataforma BR1)
  const url = "https://br1.api.riotgames.com/lol/status/v4/platform-data";
  const res = await request(url, {
    method: "GET",
    headers: { "X-Riot-Token": apiKey },
  });
  return res.statusCode;
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    if (ADMIN_IDS.size > 0 && !ADMIN_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "Sem permissão pra setar a key 😅", ephemeral: true });
    }
    const value = interaction.options.getString("value", true).trim();
    setConfig("RIOT_API_KEY", value);
    return interaction.reply({ content: "Key salva ✅", ephemeral: true });
  }

  if (sub === "test") {
    const key = getConfig("RIOT_API_KEY");
    if (!key) return interaction.reply({ content: "Nenhuma key setada. Use `/key set`.", ephemeral: true });

    try {
      const status = await testKey(key);
      if (status === 200) return interaction.reply("Key OK ✅ (BR1 status 200)");
      return interaction.reply(`Key respondeu com HTTP ${status} (ainda pode ser rate/perm)`);
    } catch (e) {
      return interaction.reply({ content: `Falha ao testar key: ${e.message}`, ephemeral: true });
    }
  }
}