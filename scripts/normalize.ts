import type { CompetitionCode } from "../src/lib/competitions";
import type { Match } from "../src/lib/domain";
export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group?: string | null;
  season: { id: number; startDate: string; endDate: string };
  homeTeam: {
    id?: number | null;
    name: string | null;
    shortName?: string | null;
    crest?: string | null;
  };
  awayTeam: {
    id?: number | null;
    name: string | null;
    shortName?: string | null;
    crest?: string | null;
  };
  score: {
    duration: string | null;
    winner?: string | null;
    halfTime?: { home: number | null; away: number | null };
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
  };
}
export function normalize(m: ApiMatch, competition: CompetitionCode): Match {
  const year = m.season.startDate.slice(0, 4);
  const seasonId = `${competition}-${year}`;
  // Stage is essential: Champions knockouts may reuse matchday numbers or have none.
  const roundId = `${seasonId}-${m.stage}-${m.matchday ?? "round"}`;
  const regulation =
    m.score.duration === "REGULAR" ? m.score.fullTime : m.score.regularTime;
  const halfScore = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : null;
  const halfTimeHomeScore = halfScore(m.score.halfTime?.home);
  const halfTimeAwayScore = halfScore(m.score.halfTime?.away);
  const winner =
    m.score.winner === "HOME_TEAM"
      ? "1"
      : m.score.winner === "AWAY_TEAM"
        ? "2"
        : m.score.winner === "DRAW"
          ? "X"
          : null;
  return {
    id: String(m.id),
    competition,
    seasonId,
    roundId,
    matchday: m.matchday ?? 0,
    stage: m.stage,
    utcDate: m.utcDate,
    status: m.status,
    home: m.homeTeam.shortName || m.homeTeam.name || "Por determinar",
    away: m.awayTeam.shortName || m.awayTeam.name || "Por determinar",
    homeTeamId: m.homeTeam.id ?? null,
    awayTeamId: m.awayTeam.id ?? null,
    scoreDuration: m.score.duration || "",
    ...(halfTimeHomeScore !== null || halfTimeAwayScore !== null
      ? { halfTimeHomeScore, halfTimeAwayScore }
      : {}),
    ...(winner ? { winner } : {}),
    homeCrest: m.homeTeam.crest || "",
    awayCrest: m.awayTeam.crest || "",
    homeScore: regulation?.home ?? null,
    awayScore: regulation?.away ?? null,
  };
}
