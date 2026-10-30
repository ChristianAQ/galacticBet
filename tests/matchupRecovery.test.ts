import { expect, it, vi } from "vitest";
import {
  createEspnClient,
  EspnRequestError,
  type EspnClient,
  type EspnEvent,
} from "../scripts/espn";
import {
  createMatchupRecovery,
  scheduleMatchups,
} from "../scripts/matchupRecovery";
import type { Match } from "../src/lib/domain";
const now = Date.parse("2026-10-30T12:00:00Z");
const match = {
  id: "1",
  competition: "PD",
  utcDate: new Date(now + 3600000).toISOString(),
} as Match;
const event = {
  id: "700",
  homeId: "83",
  awayId: "86",
  competition: "PD",
} as EspnEvent;
const game = (id: string) => ({
  id,
  date: "2025-10-01T19:00:00Z",
  competitions: [
    {
      date: "2025-10-01T19:00:00Z",
      status: { type: { completed: true, state: "post" } },
      competitors: [
        {
          homeAway: "home",
          team: { id: "86", displayName: "Madrid" },
          score: "2",
        },
        {
          homeAway: "away",
          team: { id: "83", displayName: "Barcelona" },
          score: "1",
        },
      ],
    },
  ],
});
const schedule = (id = "10") => ({ team: { id: "83" }, events: [game(id)] });
it("filtra calendarios por identidad, resultado final y pareja exacta", () => {
  expect(scheduleMatchups(schedule(), event, now)).toHaveLength(1);
  expect(
    scheduleMatchups({ ...schedule(), team: { id: "99" } }, event, now),
  ).toEqual([]);
  const unfinished = game("10");
  unfinished.competitions[0].status.type.completed = false;
  expect(
    scheduleMatchups({ team: { id: "83" }, events: [unfinished] }, event, now),
  ).toEqual([]);
  expect(scheduleMatchups(schedule(), { ...event, awayId: "99" }, now)).toEqual(
    [],
  );
});
it("recorre tres temporadas, reutiliza consultas y aplica siete días de caché", async () => {
  const request = vi.fn().mockResolvedValue(schedule());
  const recovery = createMatchupRecovery(
    { schedule: request } as unknown as EspnClient,
    now,
  );
  const result = await recovery.recover(match, event, []);
  expect(request.mock.calls.map((c) => c[2])).toEqual([2026, 2025, 2024]);
  expect(result.matches).toHaveLength(1);
  await recovery.recover(match, event, []);
  expect(request).toHaveBeenCalledTimes(3);
  const next = createMatchupRecovery(
    { schedule: request } as unknown as EspnClient,
    now + 3600000,
  );
  await next.recover(match, event, result.matches, result.checkedAt);
  expect(request).toHaveBeenCalledTimes(3);
});
it("respeta seis peticiones por ejecución y no marca como completo un historial sin consultar", async () => {
  const request = vi.fn().mockResolvedValue({ team: { id: "83" }, events: [] });
  const recovery = createMatchupRecovery(
    { schedule: request } as unknown as EspnClient,
    now,
  );
  for (const id of ["83", "84", "85"]) {
    const result = await recovery.recover(match, { ...event, homeId: id }, []);
    if (id === "85") expect(result.checkedAt).toBeUndefined();
  }
  expect(request).toHaveBeenCalledTimes(6);
});
it("tolera temporadas sin cobertura y propaga los bloqueos sin reintentos", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new EspnRequestError(404))
    .mockResolvedValue(schedule());
  const recovery = createMatchupRecovery(
    { schedule: request } as unknown as EspnClient,
    now,
  );
  expect((await recovery.recover(match, event, [])).matches).toHaveLength(1);
  const blocked = vi.fn().mockRejectedValue(new EspnRequestError(429));
  await expect(
    createMatchupRecovery(
      { schedule: blocked } as unknown as EspnClient,
      now,
    ).recover(match, event, []),
  ).rejects.toThrow("429");
  expect(blocked).toHaveBeenCalledTimes(1);
});
it("usa únicamente la URL fija del calendario y valida parámetros", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(schedule())));
  const client = createEspnClient(request);
  await client.schedule!("PD", "83", 2025);
  expect(request.mock.calls[0][0]).toBe(
    "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams/83/schedule?season=2025",
  );
  await expect(client.schedule!("PD", "../evil", 2025)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
