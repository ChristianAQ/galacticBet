import type { Firestore } from "firebase-admin/firestore";
import type { Match } from "../src/lib/domain";
import {
  insightFitsMatch,
  validMatchInsight,
  type MatchInsight,
} from "../src/lib/matchInsightsData";
import {
  createEspnClient,
  EspnRequestError,
  findEspnEvent,
  normalizeEspnSummary,
  type EspnClient,
  type EspnEvent,
} from "./espn";

const HOUR = 3_600_000;
const MAX_DOCUMENT_READS = 80;
const MAX_SUMMARIES = 24;
export interface StoredMatchInsight {
  insight: MatchInsight | null;
  checkedAt: string;
  kickoff: string;
  status: string;
}
interface SyncOptions {
  now?: number;
  client?: EspnClient;
  log?: (message: string) => void;
}
export function insightRefreshInterval(match: Match, now: number) {
  if (match.status === "FINISHED") return 24 * HOUR;
  return Date.parse(match.utcDate) - now > 2 * HOUR ? 12 * HOUR : 2 * HOUR;
}
export function insightCandidates(matches: Match[], now: number) {
  const seen = new Set<string>();
  return matches
    .filter((match) => {
      const date = Date.parse(match.utcDate);
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(match.id) ||
        seen.has(match.id) ||
        !Number.isFinite(date) ||
        date < now - 48 * HOUR ||
        date > now + 24 * HOUR ||
        !["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "FINISHED"].includes(
          match.status,
        )
      )
        return false;
      seen.add(match.id);
      return true;
    })
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.utcDate) - now) -
        Math.abs(Date.parse(b.utcDate) - now),
    )
    .slice(0, MAX_DOCUMENT_READS);
}
function validPrevious(
  value: Record<string, unknown> | undefined,
  match: Match,
): StoredMatchInsight | null {
  if (
    !value ||
    typeof value.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    typeof value.kickoff !== "string" ||
    Date.parse(value.kickoff) !== Date.parse(match.utcDate) ||
    typeof value.status !== "string"
  )
    return null;
  const insight =
    validMatchInsight(value.insight) && insightFitsMatch(value.insight, match)
      ? value.insight
      : null;
  return {
    insight,
    checkedAt: value.checkedAt,
    kickoff: value.kickoff,
    status: value.status,
  };
}
function hasInformation(value: MatchInsight | null) {
  return Boolean(
    value &&
    (value.venue ||
      value.referee ||
      value.attendance !== undefined ||
      value.goals.length ||
      value.lineups.length ||
      value.statistics.length),
  );
}
const apiDate = (date: number) =>
  new Date(date).toISOString().slice(0, 10).replaceAll("-", "");

// This is deliberately an optional enrichment after official scoring. No calendar,
// match, prediction or standing is ever read or written by this process.
export async function syncMatchInsights(
  db: Firestore,
  matches: Match[],
  options: SyncOptions = {},
) {
  const now = options.now ?? Date.now();
  const client = options.client ?? createEspnClient();
  const log = options.log ?? console.log;
  const candidates = insightCandidates(matches, now);
  const report = {
    reads: 0,
    scoreboards: 0,
    summaries: 0,
    updated: 0,
    skipped: 0,
    stopped: false,
    available: 0,
    unmatched: 0,
    rejectedSummaries: 0,
  };
  if (!candidates.length) return report;
  const snapshots = await db.getAll(
    ...candidates.map((match) => db.doc(`matchInsights/${match.id}`)),
  );
  report.reads = candidates.length;
  const prior = new Map(
    snapshots.map((snapshot) => [snapshot.id, snapshot.data()]),
  );
  report.available = candidates.filter((match) =>
    hasInformation(validPrevious(prior.get(match.id), match)?.insight || null),
  ).length;
  const pending = candidates
    .map((match) => ({
      match,
      previous: validPrevious(prior.get(match.id), match),
    }))
    .filter(({ match, previous }) => {
      const checkedAt = previous ? Date.parse(previous.checkedAt) : 0;
      const fresh =
        previous &&
        checkedAt <= now &&
        now - checkedAt < insightRefreshInterval(match, now) &&
        previous.status === match.status;
      if (fresh) report.skipped++;
      return !fresh;
    })
    .sort(
      (a, b) =>
        (a.previous ? Date.parse(a.previous.checkedAt) : -Infinity) -
        (b.previous ? Date.parse(b.previous.checkedAt) : -Infinity),
    );
  if (!pending.length) {
    log(
      `Detalles de partidos: ${report.reads} lecturas, caché vigente; 0 consultas a ESPN.`,
    );
    return report;
  }
  const listings = new Map<Match["competition"], EspnEvent[]>();
  const updates: { id: string; data: StoredMatchInsight }[] = [];
  try {
    // One interval query per competition, irrespective of the number of fixtures.
    for (const code of ["PD", "CL"] as const) {
      const dates = pending
        .filter((item) => item.match.competition === code)
        .map((item) => Date.parse(item.match.utcDate));
      if (!dates.length) continue;
      report.scoreboards++;
      listings.set(
        code,
        await client.scoreboard(
          code,
          apiDate(Math.min(...dates) - 15 * 60_000),
          apiDate(Math.max(...dates) + 15 * 60_000),
        ),
      );
    }
    for (const { match, previous } of pending) {
      const event = findEspnEvent(match, listings.get(match.competition) || []);
      let insight = previous?.insight || null;
      if (event) {
        if (report.summaries >= MAX_SUMMARIES) break;
        report.summaries++;
        const normalized = normalizeEspnSummary(
          await client.summary(match.competition, event.id),
          match,
          event,
          new Date(now).toISOString(),
        );
        if (!normalized) report.rejectedSummaries++;
        // Reconcile an official 0–0 even if summary only has a valid header.
        const confirmedNoGoals =
          match.status === "FINISHED" &&
          match.scoreDuration === "REGULAR" &&
          match.homeScore === 0 &&
          match.awayScore === 0;
        const old = previous?.insight;
        if (
          normalized &&
          (hasInformation(normalized) ||
            confirmedNoGoals ||
            (old && old.eventId !== normalized.eventId))
        ) {
          if (old && old.eventId === normalized.eventId) {
            const lineups = new Map(
              old.lineups.map((lineup) => [lineup.side, lineup]),
            );
            const statistics = new Map(
              old.statistics.map((statistic) => [statistic.label, statistic]),
            );
            for (const lineup of normalized.lineups)
              lineups.set(lineup.side, lineup);
            for (const statistic of normalized.statistics)
              statistics.set(statistic.label, statistic);
            // Missing sides/statistics are partial data, not evidence they vanished.
            // Preserve the oldest fetchedAt whenever any previous field is reused.
            const retained =
              (!confirmedNoGoals &&
                !normalized.goals.length &&
                old.goals.length > 0) ||
              old.lineups.some(
                (lineup) =>
                  !normalized.lineups.some((next) => next.side === lineup.side),
              ) ||
              old.statistics.some(
                (statistic) =>
                  !normalized.statistics.some(
                    (next) => next.label === statistic.label,
                  ),
              ) ||
              (!normalized.venue && Boolean(old.venue)) ||
              (!normalized.referee && Boolean(old.referee)) ||
              (normalized.attendance === undefined &&
                old.attendance !== undefined);
            insight = {
              ...old,
              ...normalized,
              goals: confirmedNoGoals
                ? []
                : normalized.goals.length
                  ? normalized.goals
                  : old.goals,
              lineups: [...lineups.values()],
              statistics: [...statistics.values()],
              fetchedAt: retained ? old.fetchedAt : normalized.fetchedAt,
            };
          } else
            insight = confirmedNoGoals
              ? { ...normalized, goals: [] }
              : normalized;
        }
      } else {
        report.unmatched++;
      }
      updates.push({
        id: match.id,
        data: {
          insight,
          checkedAt: new Date(now).toISOString(),
          kickoff: match.utcDate,
          status: match.status,
        },
      });
    }
  } catch (error) {
    report.stopped = true;
    // No response body, URL query, credential or uncontrolled provider text in logs.
    log(
      error instanceof EspnRequestError
        ? error.message
        : "ESPN: respuesta no utilizable; se conserva la información anterior.",
    );
  }
  if (updates.length) {
    const batch = db.batch();
    for (const update of updates)
      batch.set(db.doc(`matchInsights/${update.id}`), update.data);
    await batch.commit();
    report.updated = updates.length;
    for (const update of updates) {
      const match = candidates.find((candidate) => candidate.id === update.id)!;
      if (
        hasInformation(
          validPrevious(prior.get(update.id), match)?.insight || null,
        )
      )
        report.available--;
      if (hasInformation(update.data.insight)) report.available++;
    }
  }
  log(
    `Detalles de partidos: ${report.reads} lecturas, ${report.scoreboards} calendarios ESPN, ${report.summaries} fichas, ${report.updated} documentos actualizados, ${report.available} fichas con información, ${report.unmatched} sin asociación y ${report.rejectedSummaries} respuestas rechazadas${report.stopped ? "; proveedor interrumpido" : ""}.`,
  );
  return report;
}
