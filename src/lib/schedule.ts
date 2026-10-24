import { canPredict, hasMatchStarted, type Match } from "./domain";

export function upcomingMatches(matches: Match[], now: number) {
  return matches
    .filter((match) => canPredict(match.utcDate, now, match.status))
    .sort(
      (a, b) =>
        Date.parse(a.utcDate) - Date.parse(b.utcDate) ||
        a.id.localeCompare(b.id),
    );
}

export function roundHasStarted(matches: Match[], next: Match, now: number) {
  return matches.some(
    (match) => match.roundId === next.roundId && hasMatchStarted(match, now),
  );
}

export function kickoffCountdown(kickoff: string, now: number) {
  const minutes = Math.ceil((Date.parse(kickoff) - now) / 60_000);
  if (minutes <= 1) return "En menos de 1 min";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `En ${days} d${hours ? ` ${hours} h` : ""}`;
  if (hours)
    return `En ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return `En ${minutes} min`;
}
