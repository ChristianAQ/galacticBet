import type { Match } from "./domain";
import { LEAGUE_STAGES, leagueTable, teamKey } from "./leagueTable";
import {
  headToHead,
  previousResults,
  teamIdentity,
  teamResult,
  teamSide,
  type FormResult,
  type Side,
} from "./matchInsights";

export interface PreviewRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}
export interface PreviewFormEntry {
  id: string;
  result: FormResult;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  venue: Side;
  date: string;
}
export interface TeamPreview extends PreviewRecord {
  side: Side;
  name: string;
  position: number | null;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  venueRecord: PreviewRecord;
  form: PreviewFormEntry[];
}
export interface MatchPreviewData {
  home: TeamPreview;
  away: TeamPreview;
  tableSize: number;
  headToHead: { played: number; home: number; draws: number; away: number };
  facts: string[];
  hasData: boolean;
}

const other = (side: Side): Side => (side === "home" ? "away" : "home");
const sameCompetition = (a: Match, b: Match) =>
  a.competition === b.competition && a.seasonId === b.seasonId;
const average = (value: number, played: number) =>
  played ? (value / played).toFixed(1).replace(".", ",") : "0";

function standings(target: Match, prior: Match[]) {
  const rows = leagueTable(
    prior.filter(
      (m) => sameCompetition(m, target) && m.stage === target.stage,
    ),
  );
  return {
    size: rows.length,
    position: (key: string) => {
      const index = rows.findIndex((r) => r.key === key);
      return index < 0 ? null : index + 1;
    },
    points: (key: string) => rows.find((r) => r.key === key)?.points ?? 0,
  };
}

function streak(results: FormResult[], test: (r: FormResult) => boolean) {
  let count = 0;
  for (const r of results) {
    if (!test(r)) break;
    count++;
  }
  return count;
}

export function matchPreview(
  target: Match,
  matches: Match[],
  now = Date.now(),
): MatchPreviewData {
  const prior = previousResults(target, matches, now);
  const table = LEAGUE_STAGES.includes(target.stage)
    ? standings(target, prior)
    : null;
  const facts: string[] = [];
  const team = (side: Side): TeamPreview => {
    const identity = teamIdentity(target, side);
    const history = prior.flatMap((match) => {
      const s = teamSide(match, identity);
      return s ? [{ match, side: s, result: teamResult(match, s) }] : [];
    });
    const season = history.filter((h) => sameCompetition(h.match, target));
    const count = (list: typeof history) => ({
      played: list.length,
      wins: list.filter((h) => h.result === "win").length,
      draws: list.filter((h) => h.result === "draw").length,
      losses: list.filter((h) => h.result === "loss").length,
    });
    const scored = (h: (typeof history)[number]) =>
      h.side === "home" ? h.match.homeScore! : h.match.awayScore!;
    const conceded = (h: (typeof history)[number]) =>
      h.side === "home" ? h.match.awayScore! : h.match.homeScore!;
    const record = count(season);
    const goalsFor = season.reduce((t, h) => t + scored(h), 0);
    const goalsAgainst = season.reduce((t, h) => t + conceded(h), 0);
    const results = history.map((h) => h.result);
    const name = target[side];
    const wins = streak(results, (r) => r === "win");
    const losses = streak(results, (r) => r === "loss");
    const unbeaten = streak(results, (r) => r !== "loss");
    const winless = streak(results, (r) => r !== "win");
    if (wins >= 3) facts.push(`${name} encadena ${wins} victorias seguidas.`);
    else if (unbeaten >= 4)
      facts.push(`${name} lleva ${unbeaten} partidos sin perder.`);
    if (losses >= 3) facts.push(`${name} acumula ${losses} derrotas seguidas.`);
    else if (winless >= 4)
      facts.push(`${name} no gana desde hace ${winless} partidos.`);
    const venue = count(season.filter((h) => h.side === side));
    if (venue.played >= 3 && venue.wins === venue.played)
      facts.push(
        `${name} ha ganado todos sus partidos ${side === "home" ? "en casa" : "a domicilio"} esta temporada.`,
      );
    else if (venue.played >= 3 && venue.wins === 0)
      facts.push(
        `${name} aún no ha ganado ${side === "home" ? "en casa" : "a domicilio"} esta temporada.`,
      );
    if (record.played >= 3 && goalsFor / record.played >= 2)
      facts.push(
        `${name} promedia ${average(goalsFor, record.played)} goles por partido.`,
      );
    const key = teamKey(target, side);
    return {
      side,
      name,
      ...record,
      position: table && record.played ? table.position(key) : null,
      points: table ? table.points(key) : record.wins * 3 + record.draws,
      goalsFor,
      goalsAgainst,
      cleanSheets: season.filter((h) => conceded(h) === 0).length,
      venueRecord: venue,
      form: history
        .slice(0, 5)
        .reverse()
        .map((h) => ({
          id: h.match.id,
          result: h.result,
          opponent: h.match[other(h.side)],
          goalsFor: scored(h),
          goalsAgainst: conceded(h),
          venue: h.side,
          date: h.match.utcDate,
        })),
    };
  };
  const home = team("home");
  const away = team("away");
  const h2h = { played: 0, home: 0, draws: 0, away: 0 };
  const homeTeam = teamIdentity(target, "home");
  for (const m of headToHead(target, matches, now)) {
    const side = teamSide(m, homeTeam)!;
    const result = teamResult(m, side);
    h2h.played++;
    if (result === "win") h2h.home++;
    else if (result === "draw") h2h.draws++;
    else h2h.away++;
  }
  if (h2h.played >= 2) {
    const leader = h2h.home > h2h.away ? home : h2h.away > h2h.home ? away : null;
    const leaderWins = Math.max(h2h.home, h2h.away);
    if (leader && leaderWins * 2 > h2h.played)
      facts.push(
        `${leader.name} ha ganado ${leaderWins} de los últimos ${h2h.played} enfrentamientos.`,
      );
  }
  return {
    home,
    away,
    tableSize: table?.size ?? 0,
    headToHead: h2h,
    facts,
    hasData: home.form.length > 0 || away.form.length > 0 || h2h.played > 0,
  };
}

export function countdownLabel(kickoff: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((Date.parse(kickoff) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${minutes} min`;
}
