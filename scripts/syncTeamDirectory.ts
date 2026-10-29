import type { Firestore } from "firebase-admin/firestore";
import {
  FEATURED_TEAMS,
  validDirectory,
  playerAge,
  type ClubSquad,
  type TeamDirectory,
} from "../src/lib/teamExplorer";
export function normalizeSquad(
  value: unknown,
  id: number,
  now: number,
): ClubSquad | null {
  if (!value || typeof value !== "object") return null;
  const t = value as { id?: unknown; name?: unknown; squad?: unknown };
  if (t.id !== id || typeof t.name !== "string" || !Array.isArray(t.squad))
    return null;
  const players = t.squad.slice(0, 60).flatMap((p) => {
    if (
      !p ||
      !Number.isInteger(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim()
    )
      return [];
    const birthDate = typeof p.dateOfBirth === "string" ? p.dateOfBirth : null;
    return [
      {
        id: p.id as number,
        name: p.name.slice(0, 160),
        position:
          typeof p.position === "string" ? p.position.slice(0, 160) : "",
        nationality:
          typeof p.nationality === "string" ? p.nationality.slice(0, 160) : "",
        birthDate:
          playerAge(birthDate, new Date(now)) === null ? null : birthDate,
      },
    ];
  });
  if (!players.length) return null;
  return {
    id,
    name: t.name.slice(0, 160),
    fetchedAt: new Date(now).toISOString(),
    players: [...new Map(players.map((p) => [p.id, p])).values()],
  };
}
export async function syncTeamDirectory(
  db: Firestore,
  request: (path: string) => Promise<unknown>,
  now = Date.now(),
  log = console.log,
) {
  const ref = db.doc("teamDirectory/featured");
  const previous = (await ref.get()).data();
  const teams = validDirectory(previous) ? [...previous.teams] : [];
  const due = FEATURED_TEAMS.filter((c) => {
    const t = teams.find((t) => t.id === c.id);
    return (
      !t ||
      Date.parse(t.fetchedAt) > now ||
      now - Date.parse(t.fetchedAt) >= 86400000
    );
  });
  // Rotate missing teams too so unavailable squads cannot starve the rest.
  const offset = (Math.floor(now / 7200000) * 3) % FEATURED_TEAMS.length;
  due.sort(
    (a, b) =>
      ((FEATURED_TEAMS.findIndex((c) => c.id === a.id) - offset + 12) % 12) -
      ((FEATURED_TEAMS.findIndex((c) => c.id === b.id) - offset + 12) % 12),
  );
  let changed = false;
  for (const club of due.slice(0, 3)) {
    try {
      const squad = normalizeSquad(
        await request(`/teams/${club.id}`),
        club.id,
        now,
      );
      if (!squad) {
        log(
          `Plantilla ${club.name}: sin jugadores disponibles; se conserva la anterior.`,
        );
        continue;
      }
      const index = teams.findIndex((t) => t.id === club.id);
      if (index >= 0) teams[index] = squad;
      else teams.push(squad);
      changed = true;
    } catch {
      log(
        "Plantillas: consulta interrumpida; se conservan los datos anteriores.",
      );
      break;
    }
  }
  if (changed) {
    const data: TeamDirectory = { version: 1, teams };
    await ref.set(data);
  }
  log(
    `Plantillas: ${teams.length} clubes guardados; máximo 3 consultas por ejecución.`,
  );
}
