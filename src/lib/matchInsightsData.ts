import { validProbability, type MatchProbability } from "./matchProbability";
import { isKnownCompetition } from "./competitions";
import type { Match } from "./domain";

export interface MatchPlayer {
  name: string;
  number?: string;
  position?: string;
  starter: boolean;
}
export interface MatchLineup {
  side: "home" | "away";
  formation?: string;
  players: MatchPlayer[];
}
export interface MatchGoal {
  minute: string;
  scorer: string;
  side: "home" | "away";
  kind: "goal" | "penalty" | "own-goal";
  assist?: string;
}
export interface MatchStatistic {
  label: string;
  home: string;
  away: string;
}
export interface MatchIncident {
  side: "home" | "away";
  minute: string;
  kind: "yellow-card" | "red-card" | "second-yellow" | "substitution";
  player: string;
  playerOut?: string;
}
// Complementary information never participates in results or scoring.
export interface MatchInsight {
  version: 1;
  matchId: string;
  competition: Match["competition"];
  kickoff: string;
  provider: "ESPN";
  eventId: string;
  fetchedAt: string;
  probability?: MatchProbability;
  incidents?: MatchIncident[];
  venue?: string;
  referee?: string;
  attendance?: number;
  goals: MatchGoal[];
  lineups: MatchLineup[];
  statistics: MatchStatistic[];
}

const text = (v: unknown, max = 160): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const side = (v: unknown) => v === "home" || v === "away";
const optionalText = (v: unknown) => v === undefined || text(v);

export function validMatchInsight(value: unknown): value is MatchInsight {
  if (!record(value)) return false;
  return (
    value.version === 1 &&
    value.provider === "ESPN" &&
    text(value.matchId, 100) &&
    text(value.eventId, 30) &&
    /^\d+$/.test(value.eventId) &&
    isKnownCompetition(value.competition) &&
    text(value.kickoff) &&
    Number.isFinite(Date.parse(value.kickoff)) &&
    text(value.fetchedAt) &&
    Number.isFinite(Date.parse(value.fetchedAt)) &&
    (value.probability === undefined || validProbability(value.probability)) &&
    (value.incidents === undefined ||
      (Array.isArray(value.incidents) &&
        value.incidents.length <= 100 &&
        value.incidents.every(
          (i) =>
            record(i) &&
            side(i.side) &&
            text(i.minute, 30) &&
            text(i.player) &&
            [
              "yellow-card",
              "red-card",
              "second-yellow",
              "substitution",
            ].includes(String(i.kind)) &&
            optionalText(i.playerOut) &&
            (i.kind !== "substitution" || text(i.playerOut)),
        ))) &&
    optionalText(value.venue) &&
    optionalText(value.referee) &&
    (value.attendance === undefined ||
      (Number.isInteger(value.attendance) && Number(value.attendance) >= 0)) &&
    Array.isArray(value.goals) &&
    value.goals.length <= 40 &&
    value.goals.every(
      (g) =>
        record(g) &&
        side(g.side) &&
        text(g.minute, 30) &&
        text(g.scorer) &&
        ["goal", "penalty", "own-goal"].includes(String(g.kind)) &&
        optionalText(g.assist),
    ) &&
    Array.isArray(value.lineups) &&
    value.lineups.length <= 2 &&
    new Set(value.lineups.map((l) => (record(l) ? l.side : null))).size ===
      value.lineups.length &&
    value.lineups.every(
      (l) =>
        record(l) &&
        side(l.side) &&
        optionalText(l.formation) &&
        Array.isArray(l.players) &&
        l.players.length <= 30 &&
        l.players.every(
          (p) =>
            record(p) &&
            text(p.name) &&
            optionalText(p.number) &&
            optionalText(p.position) &&
            typeof p.starter === "boolean",
        ),
    ) &&
    Array.isArray(value.statistics) &&
    value.statistics.length <= 20 &&
    value.statistics.every(
      (s) => record(s) && text(s.label) && text(s.home, 30) && text(s.away, 30),
    )
  );
}

export function insightFitsMatch(
  data: MatchInsight,
  match: Pick<Match, "id" | "competition" | "utcDate">,
) {
  return (
    data.matchId === match.id &&
    data.competition === match.competition &&
    Date.parse(data.kickoff) === Date.parse(match.utcDate)
  );
}

export function matchExternalLinks(
  match: Match,
  insight?: MatchInsight | null,
) {
  const date = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
  }).format(new Date(match.utcDate));
  const query = `${match.home} ${match.away} ${date}`;
  return {
    television: "https://jack21eo.mpanrc4imind.my/es",
    details: `https://www.google.com/search?q=${encodeURIComponent(`${query} alineaciones goles`)}`,
    source:
      insight && /^\d+$/.test(insight.eventId)
        ? `https://www.espn.com/soccer/match/_/gameId/${insight.eventId}`
        : null,
  };
}
