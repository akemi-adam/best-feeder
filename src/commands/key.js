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

function normalizeApiKey(input) {
  // remove espaços nas pontas + quebra de linha + tabs
  let k = String(input ?? "")
    .trim()
    .replace(/[\r\n\t]/g, "");

  // remove aspas caso usuário cole "RGAPI-...."
  k = k.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");

  // remove qualquer espaço restante (inclusive no meio)
  k = k.replace(/\s+/g, "");

  return k;
}

async function testKey(apiKey) {
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

    const raw = interaction.options.getString("value", true);
    const value = normalizeApiKey(raw);

    // validação bem simples: a key da Riot dev normalmente começa com RGAPI-
    if (!value.startsWith("RGAPI-") || value.length < 20) {
      return interaction.reply({
        content: "Essa key parece inválida (formato inesperado). Cole novamente a Riot API Key (RGAPI-...).",
        ephemeral: true
      });
    }

    setConfig("RIOT_API_KEY", value);

    // opcional: já testa e devolve feedback imediato
    try {
      const status = await testKey(value);
      if (status === 200) {
        return interaction.reply({ content: "Key salva ✅ e testada ✅ (HTTP 200)", ephemeral: true });
      }
      return interaction.reply({ content: `Key salva ✅ mas o teste respondeu HTTP ${status}`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `Key salva ✅ mas o teste falhou: ${e.message}`, ephemeral: true });
    }
  }

  if (sub === "test") {
    const key = getConfig("RIOT_API_KEY");
    if (!key) return interaction.reply({ content: "Nenhuma key setada. Use `/key set`.", ephemeral: true });

    try {
      const status = await testKey(key);
      if (status === 200) return interaction.reply("Key OK ✅ (BR1 status 200)");
      return interaction.reply(`Key respondeu com HTTP ${status} (pode ser rate limit/permissão)`);
    } catch (e) {
      return interaction.reply({ content: `Falha ao testar key: ${e.message}`, ephemeral: true });
    }
  }
}