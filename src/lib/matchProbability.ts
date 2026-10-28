import type { Match } from "./domain";
export interface MatchProbability {
  home: number;
  draw: number;
  away: number;
  fetchedAt: string;
  model: "ESPN" | "ESPN_ODDS";
  bookmaker?: string;
  marketUpdatedAt?: string;
}
export function validProbability(value: unknown): value is MatchProbability {
  if (!value || typeof value !== "object") return false;
  const p = value as MatchProbability;
  return (
    (p.model === "ESPN" ||
      (p.model === "ESPN_ODDS" &&
        typeof p.bookmaker === "string" &&
        p.bookmaker.length > 0 &&
        p.bookmaker.length <= 100 &&
        typeof p.marketUpdatedAt === "string" &&
        Number.isFinite(Date.parse(p.marketUpdatedAt)))) &&
    typeof p.fetchedAt === "string" &&
    Number.isFinite(Date.parse(p.fetchedAt)) &&
    [p.home, p.draw, p.away].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100,
    ) &&
    Math.abs(p.home + p.draw + p.away - 100) <= 0.2
  );
}
// Three explicit outcomes only: never manufacture an absent draw projection.
export function parseProbability(
  value: unknown,
  homeId: string,
  awayId: string,
  fetchedAt: string,
): MatchProbability | undefined {
  if (!value || typeof value !== "object") return;
  const p = value as Record<string, unknown>;
  const home = p.homeTeam as Record<string, unknown> | undefined;
  const away = p.awayTeam as Record<string, unknown> | undefined;
  if (
    !home ||
    !away ||
    String(home.id) !== homeId ||
    String(away.id) !== awayId
  )
    return;
  const percent = (n: unknown) =>
    typeof n === "number"
      ? n
      : typeof n === "string" && /^\d{1,3}(\.\d+)?$/.test(n)
        ? Number(n)
        : NaN;
  const result: MatchProbability = {
    home: percent(home.gameProjection),
    draw: percent(p.drawChance),
    away: percent(away.gameProjection),
    model: "ESPN",
    fetchedAt,
  };
  return validProbability(result) ? result : undefined;
}

// Convert a complete 1X2 American-odds market, removing its overround.
// This is an implied market probability, not an ESPN statistical forecast.
export function probabilityFromOdds(
  value: unknown,
  fetchedAt: string,
): MatchProbability | undefined {
  if (!Array.isArray(value)) return;
  const now = Date.parse(fetchedAt);
  for (const entry of value.slice(0, 10)) {
    if (!entry || typeof entry !== "object") continue;
    const updated =
      typeof entry.lastUpdated === "string"
        ? Date.parse(entry.lastUpdated)
        : NaN;
    const bookmaker = entry.provider?.name;
    if (
      !Number.isFinite(updated) ||
      updated > now ||
      now - updated > 36 * 3_600_000 ||
      typeof bookmaker !== "string" ||
      !bookmaker.trim() ||
      bookmaker.length > 100
    )
      continue;
    const implied = (raw: unknown) => {
      const n =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && /^[+-]?\d+(\.\d+)?$/.test(raw)
            ? Number(raw)
            : NaN;
      if (!Number.isFinite(n) || Math.abs(n) < 100 || Math.abs(n) > 100000)
        return NaN;
      return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
    };
    const values = [
      entry.homeTeamOdds?.moneyLine,
      entry.drawOdds?.moneyLine,
      entry.awayTeamOdds?.moneyLine,
    ].map(implied);
    const sum = values.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum) || sum < 0.9 || sum > 1.4) continue;
    const [home, draw, away] = values.map((n) => (n / sum) * 100);
    const result: MatchProbability = {
      home,
      draw,
      away,
      fetchedAt,
      model: "ESPN_ODDS",
      bookmaker: bookmaker.trim(),
      marketUpdatedAt: new Date(updated).toISOString(),
    };
    if (validProbability(result)) return result;
  }
}

export function hasCurrentProbability(
  match: Pick<Match, "status" | "utcDate">,
  probability: MatchProbability | undefined,
  now: number,
) {
  return (
    ["TIMED", "SCHEDULED"].includes(match.status) &&
    Date.parse(match.utcDate) > now &&
    validProbability(probability) &&
    Date.parse(probability.fetchedAt) <= now &&
    now - Date.parse(probability.fetchedAt) <= 36 * 3_600_000 &&
    (probability.marketUpdatedAt === undefined ||
      (Date.parse(probability.marketUpdatedAt) <= now &&
        now - Date.parse(probability.marketUpdatedAt) <= 36 * 3_600_000))
  );
}
