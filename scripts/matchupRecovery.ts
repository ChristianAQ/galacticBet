import {
  normalizeMatchups,
  EspnRequestError,
  type EspnClient,
  type EspnEvent,
} from "./espn";
import { competitionName } from "../src/lib/competitions";
import type { Matchup } from "../src/lib/matchInsightsData";
import type { Match } from "../src/lib/domain";
type Row = Record<string, unknown>;
const row = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export function scheduleMatchups(
  value: unknown,
  event: EspnEvent,
  cutoff: number,
): Matchup[] {
  const data = row(value);
  if (String(row(data.team).id) !== event.homeId || !Array.isArray(data.events))
    return [];
  const events = data.events.slice(0, 200).filter((v) => {
    const e = row(v),
      competitions = e.competitions;
    if (!Array.isArray(competitions) || competitions.length !== 1) return false;
    const game = row(competitions[0]);
    return row(row(game.status ?? e.status).type).completed === true;
  });
  return normalizeMatchups(events, event, cutoff).map((m) => ({
    ...m,
    competition: m.competition || competitionName(event.competition, true),
  }));
}
export function mergeMatchups(...lists: Matchup[][]): Matchup[] {
  return [...new Map(lists.flat().map((m) => [m.id, m])).values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}
/** At most six schedule requests across the whole synchronization, sharing the client's 50-request budget. */
export function createMatchupRecovery(client: EspnClient, now: number) {
  let requests = 0;
  const cache = new Map<string, unknown>();
  return {
    get requests() {
      return requests;
    },
    async recover(
      match: Match,
      event: EspnEvent,
      existing: Matchup[],
      checkedAt?: string,
    ) {
      let matches = existing;
      const checked = Date.parse(checkedAt || "");
      if (
        !client.schedule ||
        matches.length >= 5 ||
        (checked <= now && now - checked < 7 * 86400000)
      )
        return { matches, checkedAt };
      const cutoff = Math.min(now, Date.parse(match.utcDate));
      const year = new Date(cutoff).getUTCFullYear();
      // Three calendar-year parameters cover current/recent soccer seasons without guessing results.
      for (const season of [year, year - 1, year - 2]) {
        const key = `${event.competition}:${event.homeId}:${season}`;
        if (!cache.has(key)) {
          if (requests >= 6) return { matches, checkedAt };
          requests++;
          try {
            cache.set(
              key,
              await client.schedule(event.competition, event.homeId, season),
            );
          } catch (error) {
            if (
              error instanceof EspnRequestError &&
              [400, 404].includes(error.status || 0)
            )
              cache.set(key, null);
            else throw error;
          }
        }
        matches = mergeMatchups(
          scheduleMatchups(cache.get(key), event, cutoff),
          matches,
        );
        if (matches.length >= 5) break;
      }
      return { matches, checkedAt: new Date(now).toISOString() };
    },
  };
}
