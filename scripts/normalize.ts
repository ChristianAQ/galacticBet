import type { Match } from "../src/lib/domain";
export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group?: string | null;
  season: { id: number; startDate: string; endDate: string };
  homeTeam: { name: string; shortName?: string; crest?: string };
  awayTeam: { name: string; shortName?: string; crest?: string };
  score: {
    duration: string;
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
  };
}
export function normalize(m: ApiMatch, competition: "PD" | "CL"): Match {
  const year = m.season.startDate.slice(0, 4);
  const seasonId = `${competition}-${year}`;
  // Stage is essential: Champions knockouts may reuse matchday numbers or have none.
  const roundId = `${seasonId}-${m.stage}-${m.matchday ?? "round"}`;
  const regulation =
    m.score.duration === "REGULAR" ? m.score.fullTime : m.score.regularTime;
  return {
    id: String(m.id),
    competition,
    seasonId,
    roundId,
    matchday: m.matchday ?? 0,
    stage: m.stage,
    utcDate: m.utcDate,
    status: m.status,
    home: m.homeTeam.shortName || m.homeTeam.name,
    away: m.awayTeam.shortName || m.awayTeam.name,
    homeCrest: m.homeTeam.crest || "",
    awayCrest: m.awayTeam.crest || "",
    homeScore: regulation?.home ?? null,
    awayScore: regulation?.away ?? null,
  };
}
