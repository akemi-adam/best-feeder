import { request } from "undici";
import * as cheerio from "cheerio";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

const LANE_MAP = {
  top: "top",
  jungle: "jungle",
  mid: "middle",
  middle: "middle",
  adc: "bottom",
  bot: "bottom",
  bottom: "bottom",
  support: "support",
  sup: "support",
};

const CHAMP_ALIASES = {
  "wukong": "monkeyking",
  "drmundo": "drmundo",
  "dr mundo": "drmundo",
  "kai'sa": "kaisa",
  "kaisa": "kaisa",
  "cho'gath": "chogath",
  "chogath": "chogath",
  "cho": "chogath",
  "kha'zix": "khazix",
  "khazix": "khazix",
  "kog'maw": "kogmaw",
  "kogmaw": "kogmaw",
  "kog": "kogmaw",
  "rek'sai": "reksai",
  "reksai": "reksai",
  "vel'koz": "velkoz",
  "velkoz": "velkoz",
  "bel'veth": "belveth",
  "belveth": "belveth",
  "k'sante": "ksante",
  "ksante": "ksante",
  "jarvan iv": "jarvaniv",
  "jarvaniv": "jarvaniv",
  "lee sin": "leesin",
  "master yi": "masteryi",
  "miss fortune": "missfortune",
  "twisted fate": "twistedfate",
  "tahm kench": "tahmkench",
  "tk": "tahmkench",
  "aurelion sol": "aurelionsol",
  "aurelion": "aurelionsol",
  "asol": "aurelionsol",
  "nunu & willump": "nunu",
  "nunu and willump": "nunu",
  "cait": "caitlyn",
  "cass": "cassiopeia",
  "ez": "ezreal",
  
};

export const data = {
  name: "build",
  description: "Busca a build pública do LoLalytics para um campeão/lane.",
  options: [
    {
      type: 3,
      name: "champ",
      description: "Ex: fiddlesticks, sona, lee sin",
      required: true,
    },
    {
      type: 3,
      name: "lane",
      description: "Lane",
      required: true,
      choices: [
        { name: "top", value: "top" },
        { name: "jungle", value: "jungle" },
        { name: "mid", value: "mid" },
        { name: "adc", value: "adc" },
        { name: "support", value: "support" },
      ]
    }
  ]
};

function normalizeChampionSlug(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");

  if (CHAMP_ALIASES[raw]) return CHAMP_ALIASES[raw];

  const compact = raw
    .replace(/'/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "");

  return CHAMP_ALIASES[compact] || compact;
}

function normalizeLane(input) {
  const lane = String(input || "").trim().toLowerCase();
  return LANE_MAP[lane] || null;
}

function decodeHtml(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getCacheKey(champSlug, laneSlug) {
  return `${champSlug}:${laneSlug}`;
}

function getCached(champSlug, laneSlug) {
  const key = getCacheKey(champSlug, laneSlug);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(champSlug, laneSlug, value) {
  cache.set(getCacheKey(champSlug, laneSlug), {
    ts: Date.now(),
    value,
  });
}

function cleanAltNames(names) {
  const blacklist = new Set([
    "LoLalytics",
    "all",
    "top lane",
    "middle lane",
    "bottom lane",
    "jungle lane",
    "support lane",
    "statmod",
  ]);

  return names
    .map(decodeHtml)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !blacklist.has(s.toLowerCase()))
    .filter(s => !/^image:/i.test(s))
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

function extractAltNames(htmlFragment) {
  const names = [...htmlFragment.matchAll(/\balt="([^"]+)"/gi)].map(m => m[1]);
  return cleanAltNames(names);
}

function sectionBetween(html, startText, endText) {
  const start = html.indexOf(startText);
  if (start === -1) return "";
  const end = html.indexOf(endText, start + startText.length);
  if (end === -1) return html.slice(start);
  return html.slice(start, end);
}

function textFromHtml(htmlFragment) {
  const $ = cheerio.load(htmlFragment);
  return $.text().replace(/\s+/g, " ").trim();
}

function extractFirstWinrateAndGames(text) {
  const m = text.match(/(\d+(?:\.\d+)?)%\s*(?:Win Rate)?\s*(\d[\d,]*)\s*Games/i);
  if (!m) return { winrate: null, games: null };
  return {
    winrate: `${m[1]}%`,
    games: m[2],
  };
}

function parseBuildPage(html, champInput, laneInput) {
  const $ = cheerio.load(html);
  const bodyText = $.text().replace(/\s+/g, " ").trim();

  const title =
    $("title").first().text().trim() ||
    `${champInput} ${laneInput}`;

  const summaryMatch = bodyText.match(/has a (\d+(?:\.\d+)?)% win rate.*?(\d[\d,]*) Games/i);
  const pageWinrate = summaryMatch ? `${summaryMatch[1]}%` : null;
  const pageGames = summaryMatch ? summaryMatch[2] : null;

  const startingBlock = sectionBetween(html, "Starting Items", "Core Build");
  const coreBlock = sectionBetween(html, "Core Build", "Item 4");

  const startingItems = extractAltNames(startingBlock).slice(0, 3);
  const coreItems = extractAltNames(coreBlock).slice(0, 3);

  const startingStats = extractFirstWinrateAndGames(textFromHtml(startingBlock));
  const coreStats = extractFirstWinrateAndGames(textFromHtml(coreBlock));

  if (coreItems.length === 0 && startingItems.length === 0) {
    throw new Error("PARSE_EMPTY_BUILD");
  }

  return {
    title,
    pageWinrate,
    pageGames,
    startingItems,
    startingStats,
    coreItems,
    coreStats,
  };
}

async function fetchLolalyticsBuild(champSlug, laneSlug) {
  const cached = getCached(champSlug, laneSlug);
  if (cached) return cached;

  const url = `https://lolalytics.com/pt_br/lol/${champSlug}/build/?lane=${laneSlug}`;
  const res = await request(url, {
    method: "GET",
    headers: {
      "user-agent": "Mozilla/5.0 BestFeederBot/1.0",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (res.statusCode >= 400) {
    throw new Error(`LOLALYTICS_HTTP_${res.statusCode}`);
  }

  const html = await res.body.text();
  const parsed = parseBuildPage(html, champSlug, laneSlug);
  setCached(champSlug, laneSlug, parsed);
  return parsed;
}

function lanePretty(lane) {
  switch (lane) {
    case "top": return "Top";
    case "jungle": return "Jungle";
    case "middle": return "Mid";
    case "bottom": return "ADC";
    case "support": return "Support";
    default: return lane;
  }
}

export async function execute(interaction) {
  const champInput = interaction.options.getString("champ", true);
  const laneInput = interaction.options.getString("lane", true);

  const champSlug = normalizeChampionSlug(champInput);
  const laneSlug = normalizeLane(laneInput);

  if (!laneSlug) {
    return interaction.reply({ content: "Lane inválida.", ephemeral: true });
  }

  await interaction.reply(`🔎 Procurando build de **${champInput}** na lane **${laneInput}**...`);

  try {
    const data = await fetchLolalyticsBuild(champSlug, laneSlug);

    const lines = [];
    lines.push(`🧠 **Build de ${champInput} ${lanePretty(laneSlug)}**`);

    if (data.pageWinrate || data.pageGames) {
      lines.push(`📈 **${data.pageWinrate ?? "?"}** de winrate em **${data.pageGames ?? "?"}** jogos`);
    }

    if (data.startingItems.length > 0) {
      let line = `🧪 Starting items: **${data.startingItems.join(" + ")}**`;
      if (data.startingStats.winrate || data.startingStats.games) {
        line += ` — ${data.startingStats.winrate ?? "?"} (${data.startingStats.games ?? "?"} jogos)`;
      }
      lines.push(line);
    }

    if (data.coreItems.length > 0) {
      let line = `🔥 Core build: **${data.coreItems.join(" → ")}**`;
      if (data.coreStats.winrate || data.coreStats.games) {
        line += ` — ${data.coreStats.winrate ?? "?"} (${data.coreStats.games ?? "?"} jogos)`;
      }
      lines.push(line);
    }

    lines.push(`*Fonte: LoLalytics* 💅`);

    return interaction.editReply(lines.join("\n"));
  } catch (e) {
    if (String(e.message).includes("LOLALYTICS_HTTP_404")) {
      return interaction.editReply("Não achei essa combinação de campeão/lane no LoLalytics.");
    }

    if (String(e.message).includes("PARSE_EMPTY_BUILD")) {
      return interaction.editReply("Achei a página, mas não consegui ler a build. O HTML do site pode ter mudado.");
    }

    return interaction.editReply(`Erro ao buscar build: ${e.message}`);
  }
}