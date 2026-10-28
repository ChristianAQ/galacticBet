import type { Match } from "./domain";
import type { MatchGoal, MatchPlayer } from "./matchInsightsData";

export function chronologicalGoals(goals: MatchGoal[]) {
  const key = (minute: string) => {
    const parts = /^(\d+)(?:\+(\d+))?$/.exec(minute.replace(/[\s'’′]/g, ""));
    return parts ? Number(parts[1]) * 1000 + Number(parts[2] || 0) : Infinity;
  };
  return [...goals].sort((a, b) => key(a.minute) - key(b.minute));
}

export function positionLines(players: MatchPlayer[]) {
  const groups: Record<string, string[]> = {
    Portería: ["G", "GK", "POR", "GOALKEEPER"],
    Defensa: [
      "D",
      "DF",
      "DEF",
      "CB",
      "LB",
      "RB",
      "LCB",
      "RCB",
      "LWB",
      "RWB",
      "DEFENDER",
    ],
    "Centro del campo": [
      "M",
      "MF",
      "MID",
      "MED",
      "CM",
      "DM",
      "AM",
      "LM",
      "RM",
      "CDM",
      "CAM",
      "MIDFIELDER",
    ],
    Ataque: ["F", "FW", "ATT", "DEL", "ST", "CF", "LW", "RW", "FORWARD"],
  };
  const starters = players.filter((p) => p.starter);
  const lines = Object.entries(groups).map(([label, positions]) => ({
    label,
    players: starters.filter((p) =>
      positions.includes((p.position || "").toUpperCase()),
    ),
  }));
  const assigned = new Set(lines.flatMap((line) => line.players));
  return { lines, unknown: starters.filter((p) => !assigned.has(p)) };
}

export function statisticShares(home: string, away: string) {
  const parse = (value: string) =>
    /^\d+(?:[.,]\d+)?%?$/.test(value)
      ? Number(value.replace("%", "").replace(",", "."))
      : NaN;
  const h = parse(home),
    a = parse(away);
  if (!Number.isFinite(h) || !Number.isFinite(a) || h + a === 0) return null;
  return [(h / (h + a)) * 100, (a / (h + a)) * 100] as const;
}

export function canAddMatchToCalendar(match: Match, now = Date.now()) {
  return (
    ["TIMED", "SCHEDULED"].includes(match.status) &&
    Date.parse(match.utcDate) > now
  );
}
export function matchCalendarFile(match: Match, now = Date.now()) {
  if (!canAddMatchToCalendar(match, now))
    throw new Error("Este partido no tiene un inicio futuro confirmado.");
  const escape = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,");
  const date = (value: number) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  // Fold at 75 UTF-8 octets, without splitting accented characters (RFC 5545).
  const fold = (line: string) => {
    let out = "",
      size = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (size + bytes > 75) {
        out += "\r\n ";
        size = 1;
      }
      out += char;
      size += bytes;
    }
    return out;
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GalacticBet//Partidos//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${encodeURIComponent(match.id)}@galacticbet`,
    `DTSTAMP:${date(now)}`,
    `DTSTART:${date(Date.parse(match.utcDate))}`,
    `SUMMARY:${escape(`${match.home} – ${match.away}`)}`,
    `DESCRIPTION:${escape(`${match.competition === "PD" ? "LaLiga" : "Champions League"} · GalacticBet. Revisa el horario en la aplicación antes del partido; este evento no se actualiza automáticamente.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:El partido comienza en 30 minutos",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
