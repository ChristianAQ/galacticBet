import { outcome, type Match } from "./domain";
import { hasRegulationResult } from "./matchInsights";

/** Final match statistics, separated from the 90-minute result used for scoring. */
export function finishedMatchResult(match: Match) {
  if (match.status !== "FINISHED") return null;
  const regulation = hasRegulationResult(match)
    ? { home: match.homeScore!, away: match.awayScore! }
    : null;
  const extended = ["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
    match.scoreDuration || "",
  );
  const sign = regulation ? outcome(regulation.home, regulation.away) : null;
  // A draw at 90 minutes never identifies who won after extra time or penalties.
  const winner = extended ? match.winner || null : sign || match.winner || null;
  const winnerName =
    winner === "1" ? match.home : winner === "2" ? match.away : null;
  const halfHome = match.halfTimeHomeScore;
  const halfAway = match.halfTimeAwayScore;
  const halfTime =
    regulation &&
    typeof halfHome === "number" &&
    Number.isInteger(halfHome) &&
    halfHome >= 0 &&
    halfHome <= regulation.home &&
    typeof halfAway === "number" &&
    Number.isInteger(halfAway) &&
    halfAway >= 0 &&
    halfAway <= regulation.away
      ? { home: halfHome, away: halfAway }
      : null;
  return {
    regulation,
    sign,
    winner,
    winnerName,
    extended,
    decision:
      match.scoreDuration === "PENALTY_SHOOTOUT"
        ? "En penaltis"
        : extended
          ? "En la prórroga"
          : regulation
            ? "A 90 minutos"
            : "Finalizado",
    halfTime,
    secondHalf:
      regulation && halfTime
        ? {
            home: regulation.home - halfTime.home,
            away: regulation.away - halfTime.away,
          }
        : null,
    totalGoals: regulation ? regulation.home + regulation.away : null,
  };
}
