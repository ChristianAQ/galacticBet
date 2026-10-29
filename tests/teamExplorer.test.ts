import { describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  normalizeSquad,
  syncTeamDirectory,
} from "../scripts/syncTeamDirectory";
import {
  FEATURED_TEAMS,
  playerAge,
  validDirectory,
} from "../src/lib/teamExplorer";
const now = Date.parse("2026-10-29T00:00:00Z");
const source = (id: number) => ({
  id,
  name: "Club",
  squad: [
    {
      id: 1,
      name: "Jugador",
      dateOfBirth: "2000-10-30",
      position: "Goalkeeper",
      nationality: "Spain",
    },
  ],
});
describe("Directorio de equipos", () => {
  it("calcula edades por cumpleaños y rechaza fechas imposibles", () => {
    expect(playerAge("2000-10-30", new Date(now))).toBe(25);
    expect(playerAge("2000-10-29", new Date(now))).toBe(26);
    expect(playerAge("2000-02-30", new Date(now))).toBeNull();
    expect(playerAge("2027-01-01", new Date(now))).toBeNull();
    expect(playerAge(null, new Date(now))).toBeNull();
  });
  it("valida identidad, conserva ausencias y no inventa notas o valores", () => {
    expect(normalizeSquad(source(81), 86, now)).toBeNull();
    expect(
      normalizeSquad({ id: 81, name: "Club", squad: [] }, 81, now),
    ).toBeNull();
    const squad = normalizeSquad(source(81), 81, now)!;
    expect(validDirectory({ version: 1, teams: [squad] })).toBe(true);
    expect(squad.players[0]).not.toHaveProperty("rating");
    expect(squad.players[0]).not.toHaveProperty("marketValue");
  });
  it("limita consultas, preserva clubes previos y evita descargar plantillas vigentes", async () => {
    const teams = FEATURED_TEAMS.map((c) =>
      normalizeSquad(source(c.id), c.id, now)!,
    );
    const set = vi.fn();
    const get = vi
      .fn()
      .mockResolvedValue({ data: () => ({ version: 1, teams }) });
    const db = { doc: () => ({ get, set }) } as unknown as Firestore;
    const request = vi.fn(async (path: string) =>
      source(Number(path.split("/").pop())),
    );
    await syncTeamDirectory(db, request, now, vi.fn());
    expect(request).not.toHaveBeenCalled();
    await syncTeamDirectory(db, request, now + 86400000, vi.fn());
    expect(request).toHaveBeenCalledTimes(3);
    expect(set.mock.calls[0][0].teams).toHaveLength(12);
    expect(validDirectory(set.mock.calls[0][0])).toBe(true);
  });
  it("un fallo no borra las plantillas ni sigue consumiendo API", async () => {
    const set = vi.fn();
    const db = {
      doc: () => ({ get: async () => ({ data: () => undefined }), set }),
    } as unknown as Firestore;
    const request = vi.fn().mockRejectedValue(new Error("429"));
    await syncTeamDirectory(db, request, now, vi.fn());
    expect(request).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });
});
