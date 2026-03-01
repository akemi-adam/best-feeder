import { request } from "undici";
import { getConfig } from "../db/db.js";

const AMERICAS = "https://americas.api.riotgames.com";
const BR1 = "https://br1.api.riotgames.com"; // reservado (Summoner-v4 etc)

function riotKey() {
  const key = getConfig("RIOT_API_KEY");
  if (!key) throw new Error("RIOT_API_KEY_NOT_SET");
  return key;
}

async function riotGet(url) {
  const apiKey = riotKey();
  const res = await request(url, {
    method: "GET",
    headers: { "X-Riot-Token": apiKey },
  });

  const text = await res.body.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (res.statusCode >= 400) {
    const msg = typeof data === "object" ? JSON.stringify(data) : String(data);
    const err = new Error(`RIOT_HTTP_${res.statusCode}: ${msg}`);
    err.statusCode = res.statusCode;
    throw err;
  }
  return data;
}

export async function getAccountByRiotId(gameName, tagLine) {
  const url = `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotGet(url);
}

export async function getMatchIdsByPuuid(puuid, count = 20, start = 0) {
  const url = `${AMERICAS}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}`;
  return riotGet(url);
}

export async function getMatchById(matchId) {
  const url = `${AMERICAS}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return riotGet(url);
}