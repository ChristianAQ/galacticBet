export const COMPETITION_CODES = ["PD", "CL", "PL"] as const;
// Retired codes remain readable for previously saved records only.
export type CompetitionCode = keyof typeof COMPETITIONS;
export const COMPETITIONS = {
  PD: { name: "LaLiga EA Sports", short: "LaLiga", mark: "LL", espn: "esp.1" },
  CL: {
    name: "UEFA Champions League",
    short: "Champions",
    mark: "✦",
    espn: "uefa.champions",
  },
  PL: {
    name: "Premier League",
    short: "Premier League",
    mark: "PL",
    espn: "eng.1",
  },
  CDR: {
    name: "Copa del Rey",
    short: "Copa del Rey",
    mark: "CR",
    espn: "esp.copa_del_rey",
  },
} as const;
export function isCompetition(value: unknown): value is CompetitionCode {
  return (
    typeof value === "string" &&
    COMPETITION_CODES.some((code) => code === value)
  );
}
export function competitionCode(value: unknown): CompetitionCode {
  return isCompetition(value) ? value : "PD";
}
export function competitionName(value: unknown, short = false) {
  return isCompetition(value)
    ? COMPETITIONS[value][short ? "short" : "name"]
    : "Competición";
}

export function isKnownCompetition(value: unknown): value is CompetitionCode {
  return typeof value === "string" && Object.hasOwn(COMPETITIONS, value);
}
