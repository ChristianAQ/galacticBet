import { canPredict, type Match } from "./domain";
import { COMPETITION_CODES, type CompetitionCode } from "./competitions";
import { hasRegulationResult } from "./matchInsights";
import { roundOptions, type RoundOption } from "./roundOptions";

export interface OpenRound extends RoundOption {
  competition: CompetitionCode;
  deadline: number;
}

export function liveMatches(matches: Match[]) {
  return matches
    .filter((m) => ["IN_PLAY", "PAUSED"].includes(m.status))
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

export function recentResults(matches: Match[], now: number, limit = 8) {
  return matches
    .filter((m) => hasRegulationResult(m) && Date.parse(m.utcDate) <= now)
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, limit);
}

// The earliest round per competition whose first fixture has not kicked off yet.
export function openRounds(matches: Match[], now: number): OpenRound[] {
  return COMPETITION_CODES.flatMap((competition) => {
    const own = matches.filter(
      (m) =>
        m.competition === competition &&
        !["POSTPONED", "CANCELLED"].includes(m.status),
    );
    const round = roundOptions(own, now)
      .filter(
        (r) =>
          r.state === "open" &&
          own.some(
            (m) => m.roundId === r.id && canPredict(m.utcDate, now, m.status),
          ),
      )
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    return round
      ? [{ ...round, competition, deadline: Date.parse(round.start) }]
      : [];
  }).sort((a, b) => a.deadline - b.deadline);
}
