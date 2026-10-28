import { describe, expect, it, vi } from "vitest";
import type { Match } from "../src/lib/domain";
import {
  canonicalTeamName,
  createEspnClient,
  EspnRequestError,
  findEspnEvent,
  normalizeEspnSummary,
  parseEspnScoreboard,
} from "../scripts/espn";
import { validMatchInsight } from "../src/lib/matchInsightsData";

// Synthetic schema examples: no real match data is bundled into production.
const match: Match = {
  id: "123",
  competition: "PD",
  seasonId: "PD-2026",
  roundId: "r1",
  matchday: 10,
  stage: "REGULAR_SEASON",
  utcDate: "2026-10-28T20:00:00Z",
  status: "FINISHED",
  home: "FC Barcelona",
  away: "Real Madrid CF",
  homeScore: 2,
  awayScore: 1,
};
const competition = {
  id: "777",
  date: match.utcDate,
  competitors: [
    { homeAway: "home", team: { id: "83", displayName: "Barcelona" } },
    { homeAway: "away", team: { id: "86", displayName: "Real Madrid" } },
  ],
};
const scoreboard = { events: [{ id: "777", competitions: [competition] }] };
const event = parseEspnScoreboard(scoreboard, "PD")[0];
const athlete = (name: string) => ({ athlete: { displayName: name } });
const goal = (
  id: string,
  type = "Goal",
  more: Record<string, unknown> = {},
) => ({
  id,
  type: { text: type },
  clock: { displayValue: "90'+2'" },
  team: { id: "83" },
  scoringPlay: true,
  participants: [athlete("Jugador local")],
  ...more,
});
function summary(extra: Record<string, unknown> = {}) {
  return {
    header: {
      id: "777",
      league: { slug: "esp.1" },
      competitions: [competition],
    },
    ...extra,
  };
}

describe("ESPN: asociación y datos complementarios", () => {
  it("asocia alias explícitos, mismo torneo, localía y hora, sin coincidencias difusas", () => {
    expect(findEspnEvent(match, [event])).toEqual(event);
    expect(canonicalTeamName(" Atlético Madrid ")).toBe(
      canonicalTeamName("Club Atlético de Madrid"),
    );
    expect(
      findEspnEvent({ ...match, home: "Barcelona B" }, [event]),
    ).toBeNull();
    expect(findEspnEvent({ ...match, competition: "CL" }, [event])).toBeNull();
    expect(
      findEspnEvent({ ...match, home: match.away, away: match.home }, [event]),
    ).toBeNull();
    expect(
      findEspnEvent({ ...match, utcDate: "2026-10-28T20:16:00Z" }, [event]),
    ).toBeNull();
    expect(
      findEspnEvent({ ...match, utcDate: "2026-10-28T20:15:00Z" }, [event]),
    ).toEqual(event);
  });
  it("reconoce shortName de Football-Data mediante alias explícitos", () => {
    for (const [short, full] of [
      ["Barça", "Barcelona"],
      ["Atleti", "Atlético Madrid"],
      ["PSG", "Paris Saint-Germain"],
      ["FC Bayern", "Bayern Munich"],
    ]) {
      expect(canonicalTeamName(short)).toBe(canonicalTeamName(full));
    }
    expect(canonicalTeamName("Barcelona B")).not.toBe(
      canonicalTeamName("Barça"),
    );
  });
  it("deduplica el mismo gol con asistencia parcial y formatos de minuto equivalentes", () => {
    for (const assistedFirst of [false, true]) {
      const assisted = goal("1", "Goal", {
        clock: { displayValue: "90 + 02" },
        assist: athlete("Asistente"),
      });
      const plain = goal("1");
      const data = normalizeEspnSummary(
        summary({
          keyEvents: [assistedFirst ? assisted : plain],
          scoringPlays: [assistedFirst ? plain : assisted],
        }),
        match,
        event,
      )!;
      expect(data.goals).toHaveLength(1);
      expect(data.goals[0].assist).toBe("Asistente");
    }
  });
  it("no confunde goles diferentes que reutilicen ID ni dos goles con ID propio en un minuto", () => {
    const data = normalizeEspnSummary(
      summary({
        keyEvents: [
          goal("1", "Goal", { clock: { displayValue: "20'" } }),
          goal("1", "Goal", { clock: { displayValue: "21'" } }),
          goal("2", "Goal", { clock: { displayValue: "21'" } }),
        ],
        scoringPlays: [
          goal("1", "Goal", {
            clock: { displayValue: "20" },
            assist: athlete("Asistente"),
          }),
        ],
      }),
      match,
      event,
    )!;
    expect(data.goals).toHaveLength(3);
    expect(data.goals[0].assist).toBe("Asistente");
  });

  it("rechaza candidatos ambiguos, calendarios inválidos y equipos sin identificar", () => {
    expect(findEspnEvent(match, [event, { ...event, id: "778" }])).toBeNull();
    expect(() => parseEspnScoreboard({ error: "unavailable" }, "PD")).toThrow();
    expect(
      parseEspnScoreboard(
        {
          events: [
            {
              competitions: [
                { ...competition, competitors: [{ homeAway: "home" }] },
              ],
            },
          ],
        },
        "PD",
      ),
    ).toEqual([]);
  });
  it("revalida la cabecera de summary y no acepta otro partido ni competición", () => {
    expect(normalizeEspnSummary(summary(), match, event)).not.toBeNull();
    expect(
      normalizeEspnSummary(
        { header: { competitions: [{ ...competition, id: "778" }] } },
        match,
        event,
      ),
    ).toBeNull();
    expect(
      normalizeEspnSummary(
        {
          header: {
            competitions: [{ ...competition, date: "2026-11-01T20:00:00Z" }],
          },
        },
        match,
        event,
      ),
    ).toBeNull();
    expect(
      normalizeEspnSummary(
        summary({
          header: {
            league: { slug: "uefa.champions" },
            competitions: [competition],
          },
        }),
        match,
        event,
      ),
    ).toBeNull();
  });
  it("normaliza goles, penaltis, autogoles y asistencias sin incluir la tanda ni goles anulados", () => {
    const data = normalizeEspnSummary(
      summary({
        keyEvents: [
          goal("1", "Goal", {
            participants: [
              { ...athlete("Goleador"), type: "scorer" },
              { ...athlete("Asistente"), type: "assist" },
            ],
          }),
          goal("2", "Penalty - Scored", { clock: { displayValue: "42'" } }),
          goal("3", "Own Goal", {
            clock: { displayValue: "60'" },
            team: { id: "83" },
            scoringTeam: { id: "86" },
          }),
          goal("4", "Penalty Shootout"),
          goal("5", "Goal", { period: { number: 5 } }),
          goal("6", "Disallowed Goal"),
          goal("7", "Goal", { scoringPlay: false }),
          goal("8", "Penalty missed"),
          goal("9", "Goal", { team: { id: "999" } }),
          goal("10", "Goal", { clock: {} }),
          goal("11", "Own Goal"),
        ],
      }),
      match,
      event,
    )!;
    expect(data.goals).toEqual([
      {
        side: "home",
        minute: "90'+2'",
        scorer: "Goleador",
        assist: "Asistente",
        kind: "goal",
      },
      { side: "home", minute: "42'", scorer: "Jugador local", kind: "penalty" },
      {
        side: "away",
        minute: "60'",
        scorer: "Jugador local",
        kind: "own-goal",
      },
    ]);
    expect(validMatchInsight(data)).toBe(true);
  });
  it("deduplica eventos repetidos entre las dos listas y acepta scoringPlays sin keyEvents", () => {
    const single = goal("1");
    const normalized = normalizeEspnSummary(
      summary({ keyEvents: [single], scoringPlays: [{ ...single, id: "2" }] }),
      match,
      event,
    )!;
    expect(normalized.goals).toHaveLength(1);
    expect(
      normalizeEspnSummary(summary({ scoringPlays: [single] }), match, event)
        ?.goals,
    ).toHaveLength(1);
  });
  it("solo publica jugadores con titularidad explícita y conserva dorsales y posición", () => {
    const data = normalizeEspnSummary(
      summary({
        rosters: [
          {
            team: { id: "83" },
            formation: "4-3-3",
            roster: [
              {
                ...athlete("Portero"),
                starter: true,
                jersey: "1",
                position: { abbreviation: "GK" },
              },
              { ...athlete("Suplente"), starter: false, jersey: 12 },
              { ...athlete("Plantilla sin confirmar") },
            ],
          },
          {
            team: { id: "999" },
            roster: [{ ...athlete("Equipo incorrecto"), starter: true }],
          },
        ],
      }),
      match,
      event,
    )!;
    expect(data.lineups).toEqual([
      {
        side: "home",
        formation: "4-3-3",
        players: [
          { name: "Portero", starter: true, number: "1", position: "GK" },
          { name: "Suplente", starter: false, number: "12" },
        ],
      },
    ]);
  });
  it("publica solo estadísticas numéricas presentes en ambos equipos y no inventa ceros", () => {
    const data = normalizeEspnSummary(
      summary({
        boxscore: {
          players: [
            {
              team: { id: "83" },
              statistics: [
                { name: "possessionPct", displayValue: "62.5" },
                { name: "shotsOnTarget", displayValue: "0" },
                { name: "cornerKicks", displayValue: "3" },
              ],
            },
            {
              team: { id: "86" },
              statistics: [
                { name: "possessionPct", displayValue: "37.5%" },
                { name: "shotsOnTarget", displayValue: "2" },
                { name: "cornerKicks", displayValue: "--" },
              ],
            },
          ],
        },
        gameInfo: {
          venue: { fullName: "Estadio" },
          attendance: 45000,
          officials: [{ type: "Referee", displayName: "Árbitro" }],
        },
      }),
      match,
      event,
    )!;
    expect(data.statistics).toEqual([
      { label: "Posesión", home: "62.5%", away: "37.5%" },
      { label: "Remates a puerta", home: "0", away: "2" },
    ]);
    expect(data).toMatchObject({
      venue: "Estadio",
      attendance: 45000,
      referee: "Árbitro",
    });
    expect(normalizeEspnSummary(summary(), match, event)).toMatchObject({
      goals: [],
      lineups: [],
      statistics: [],
    });
  });
  it("usa hosts y rutas fijos, no envía claves y detiene HTTP 429 sin reintento masivo", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(scoreboard), { status: 200 }),
      );
    const client = createEspnClient(request);
    await client.scoreboard("PD", "20261028", "20261029");
    expect(request.mock.calls[0][0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261028-20261029&limit=100",
    );
    expect(request.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
    });
    await expect(client.summary("PD", "../../secret")).rejects.toThrow();
    request.mockResolvedValue(
      new Response("provider details", { status: 429 }),
    );
    await expect(client.summary("CL", "777")).rejects.toBeInstanceOf(
      EspnRequestError,
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("convierte timeout y JSON inválido en errores seguros", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("arbitrary provider detail"));
    await expect(
      createEspnClient(request).summary("PD", "777"),
    ).rejects.toThrow("ESPN no respondió");
    request.mockResolvedValue(new Response("<html>unavailable</html>"));
    await expect(
      createEspnClient(request).summary("PD", "777"),
    ).rejects.toThrow("ESPN no respondió");
  });
});
