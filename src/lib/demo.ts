import type { Match } from "./domain";
// Explicit opt-in demonstration data. Never written to Firestore or used by synchronization.
export const demoMatches: Match[] = [
  ["Real Madrid", "FC Barcelona", "86", "81", "2026-10-24T19:00:00Z"],
  ["Atlético de Madrid", "Real Betis", "78", "90", "2026-10-24T16:30:00Z"],
  ["Athletic Club", "Real Sociedad", "77", "92", "2026-10-25T17:30:00Z"],
  ["Villarreal CF", "Sevilla FC", "94", "559", "2026-10-25T20:00:00Z"],
  ["Valencia CF", "CA Osasuna", "95", "79", "2026-10-26T20:00:00Z"],
].map((m, i) => ({
  id: `demo-${i}`,
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "PD-2026-REGULAR_SEASON-10",
  matchday: 10,
  stage: "REGULAR_SEASON",
  utcDate: m[4],
  status: "TIMED",
  home: m[0],
  away: m[1],
  homeCrest: `https://crests.football-data.org/${m[2]}.png`,
  awayCrest: `https://crests.football-data.org/${m[3]}.png`,
  homeScore: null,
  awayScore: null,
}));
