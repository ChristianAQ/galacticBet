import { createHash } from "node:crypto";
import {
  score,
  validPrediction,
  type Match,
  type Mode,
  type Outcome,
  type Prediction,
} from "../src/lib/domain";
export interface RoundTotal {
  points: number;
  hits: number;
}
export interface Standing extends RoundTotal {
  rounds: Record<string, RoundTotal>;
}
export interface StoredPrediction {
  userId: string;
  matchId: string;
  value: Outcome | Prediction;
}
export function resultFingerprint(matches: Match[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        matches
          .filter((m) => m.status === "FINISHED")
          .map((m) => [m.id, m.homeScore, m.awayScore])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ),
    )
    .digest("hex");
}
export function scoreRound(
  mode: Mode,
  fixtures: Match[],
  predictions: StoredPrediction[],
  members: string[],
): Map<string, RoundTotal> {
  const totals = new Map(members.map((id) => [id, { points: 0, hits: 0 }]));
  const byId = new Map(fixtures.map((m) => [m.id, m]));
  for (const p of predictions) {
    const m = byId.get(p.matchId);
    const total = totals.get(p.userId);
    if (
      !m ||
      !total ||
      m.status !== "FINISHED" ||
      m.homeScore === null ||
      m.awayScore === null
    )
      continue;
    if (
      mode === "classic" &&
      (typeof p.value !== "string" || !["1", "X", "2"].includes(p.value))
    )
      continue;
    if (
      mode === "exact" &&
      (typeof p.value !== "object" || !p.value || !validPrediction(p.value))
    )
      continue;
    const points = score(mode, p.value, {
      home: m.homeScore,
      away: m.awayScore,
    });
    total.points += points;
    total.hits += points > 0 ? 1 : 0;
  }
  return totals;
}
export function sumRounds(rounds: Record<string, RoundTotal>): Standing {
  const all = Object.values(rounds);
  return {
    rounds,
    points: all.reduce((sum, r) => sum + r.points, 0),
    hits: all.reduce((sum, r) => sum + r.hits, 0),
  };
}
