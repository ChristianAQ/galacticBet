import type { Match } from "./domain";
import { insightFitsMatch, type MatchInsight } from "./matchInsightsData";
import { hasCurrentProbability } from "./matchProbability";
export type DetailTab =
  "probability" | "goals" | "lineups" | "statistics" | "matchups";
export function availableMatchTabs(
  match: Match,
  insight: MatchInsight | null,
  now = Date.now(),
): DetailTab[] {
  if (!insight || !insightFitsMatch(insight, match)) return [];
  const available: DetailTab[] = [];
  if (hasCurrentProbability(match, insight.probability, now))
    available.push("probability");
  if (
    insight.matchups?.length &&
    ["TIMED", "SCHEDULED"].includes(match.status) &&
    Date.parse(match.utcDate) > now
  )
    available.push("matchups");
  if (insight.goals.length || insight.incidents?.length)
    available.push("goals");
  if (insight.lineups.some((l) => l.players.length > 0))
    available.push("lineups");
  if (insight.statistics.length) available.push("statistics");
  return available;
}
