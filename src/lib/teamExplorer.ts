export const FEATURED_TEAMS = [
  { id: 81, name: "Barcelona" },
  { id: 86, name: "Real Madrid" },
  { id: 78, name: "Atlético de Madrid" },
  { id: 65, name: "Manchester City" },
  { id: 64, name: "Liverpool" },
  { id: 57, name: "Arsenal" },
  { id: 61, name: "Chelsea" },
  { id: 66, name: "Manchester United" },
  { id: 5, name: "Bayern Múnich" },
  { id: 524, name: "PSG" },
  { id: 108, name: "Inter" },
  { id: 109, name: "Juventus" },
] as const;
export interface SquadPlayer {
  id: number;
  name: string;
  position: string;
  birthDate: string | null;
  nationality: string;
}
export interface ClubSquad {
  id: number;
  name: string;
  fetchedAt: string;
  players: SquadPlayer[];
}
export interface TeamDirectory {
  version: 1;
  teams: ClubSquad[];
}
export function playerAge(
  birthDate: string | null,
  now = new Date(),
): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const date = new Date(`${birthDate}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== birthDate
  )
    return null;
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() &&
      now.getUTCDate() < date.getUTCDate())
  )
    age--;
  return age >= 0 && age <= 100 ? age : null;
}
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 160;
export function validDirectory(value: unknown): value is TeamDirectory {
  if (!value || typeof value !== "object") return false;
  const d = value as TeamDirectory;
  return (
    d.version === 1 &&
    Array.isArray(d.teams) &&
    d.teams.length <= FEATURED_TEAMS.length &&
    d.teams.every(
      (t) =>
        t &&
        FEATURED_TEAMS.some((c) => c.id === t.id) &&
        text(t.name) &&
        Number.isFinite(Date.parse(t.fetchedAt)) &&
        Array.isArray(t.players) &&
        t.players.length <= 60 &&
        t.players.every(
          (p) =>
            p &&
            Number.isInteger(p.id) &&
            text(p.name) &&
            text(p.position) &&
            text(p.nationality) &&
            (p.birthDate === null ||
              (typeof p.birthDate === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate))),
        ),
    )
  );
}
export function positionName(position: string) {
  return (
    (
      {
        Goalkeeper: "Portero",
        Defence: "Defensa",
        Midfield: "Centrocampista",
        Offence: "Delantero",
        "Centre-Back": "Central",
        "Left-Back": "Lateral izquierdo",
        "Right-Back": "Lateral derecho",
        "Defensive Midfield": "Mediocentro defensivo",
        "Central Midfield": "Centrocampista",
        "Attacking Midfield": "Mediapunta",
        "Left Winger": "Extremo izquierdo",
        "Right Winger": "Extremo derecho",
        "Centre-Forward": "Delantero centro",
      } as Record<string, string>
    )[position] ||
    position ||
    "Posición no disponible"
  );
}
