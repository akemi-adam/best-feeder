export function parseRiotId(input) {
  // aceita "Ganest11#GPS" com ou sem espaços
  const trimmed = input.trim();
  const parts = trimmed.split("#");
  if (parts.length !== 2) return null;
  const gameName = parts[0].trim();
  const tagLine = parts[1].trim();
  if (!gameName || !tagLine) return null;
  return { gameName, tagLine };
}

export function extractParticipant(matchDto, puuid) {
  const participants = matchDto?.info?.participants ?? [];
  return participants.find(p => p.puuid === puuid) ?? null;
}