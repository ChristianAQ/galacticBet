import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import {
  CollectionReference,
  Query,
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { scoringCalendar, syncCalendars } from "../scripts/calendarSync";
import { recompute } from "../scripts/recompute";
import { normalize, type ApiMatch } from "../scripts/normalize";
import { decodeCalendar } from "../src/lib/calendar";
import { decodeDelivery, encodeDelivery } from "../src/lib/roundDelivery";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const raw = (id: number): ApiMatch => ({
  id,
  utcDate: "2026-10-24T19:00:00Z",
  status: "TIMED",
  matchday: Math.floor(id / 10) + 1,
  stage: "REGULAR_SEASON",
  season: { id: 1, startDate: "2026-08-01", endDate: "2027-06-01" },
  homeTeam: { id: 1, name: "Local" },
  awayTeam: { id: 2, name: "Visitante" },
  score: { duration: "REGULAR", fullTime: { home: null, away: null } },
});
const finished = (home: number, away: number): ApiMatch => ({
  ...raw(1),
  status: "FINISHED",
  score: { duration: "REGULAR", fullTime: { home, away } },
});

describe.skipIf(!enabled)(
  "Sincronización: lecturas, recuperación y puntuación en Firestore",
  () => {
    let app: App;
    let db: Firestore;
    beforeAll(() => {
      // Explicit isolated emulator project; never resolve production credentials.
      app = initializeApp(
        { projectId: "demo-galacticbet-calendar-tests" },
        "calendar-tests",
      );
      db = getFirestore(app);
    });
    beforeEach(async () => {
      const response = await fetch(
        `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-galacticbet-calendar-tests/databases/(default)/documents`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error("No se pudo limpiar el emulador aislado.");
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      if (app) await deleteApp(app);
    });

    it("sincroniza 380 partidos leyendo un único documento y publica todas las jornadas", async () => {
      const reads = vi.spyOn(db, "getAll");
      const collectionReads = vi.spyOn(db, "collection");
      const fixtures = Array.from({ length: 380 }, (_, i) => raw(i));
      const cache = await syncCalendars(db, "PD", fixtures);
      expect(reads).toHaveBeenCalledTimes(1);
      expect(collectionReads).not.toHaveBeenCalled();
      expect(cache.get("PD-2026")).toHaveLength(380);
      const calendar = await db.doc("calendars/PD-2026").get();
      expect(decodeCalendar(calendar.data()!)).toHaveLength(380);
      expect(
        (await db.doc("matches/379").get())
          .data()
          ?.kickoffAt.toDate()
          .toISOString(),
      ).toBe(new Date(raw(379).utcDate).toISOString());
      expect(
        (await db.doc("rounds/PD-2026-REGULAR_SEASON-38").get()).exists,
      ).toBe(true);
    });
    it("una reejecución idéntica no reescribe partidos ni calendario aunque cambie el orden de la API", async () => {
      await syncCalendars(db, "PD", [raw(1), raw(2)]);
      const fixture = await db.doc("matches/1").get();
      const calendar = await db.doc("calendars/PD-2026").get();
      const batches = vi.spyOn(db, "batch");
      await syncCalendars(db, "PD", [raw(2), raw(1)]);
      expect(batches).not.toHaveBeenCalled();
      expect((await db.doc("matches/1").get()).updateTime).toEqual(
        fixture.updateTime,
      );
      expect((await db.doc("calendars/PD-2026").get()).updateTime).toEqual(
        calendar.updateTime,
      );
    });
    it("solo escribe el partido modificado y omite lecturas de clasificación y pronósticos si nada cambia", async () => {
      let cache = await syncCalendars(db, "PD", [raw(1), raw(2)]);
      await db.doc("groups/g").set({ memberIds: ["alice"] });
      await db
        .doc("groups/g/gameSeasons/PD-2026")
        .set({ competition: "PD", seasonId: "PD-2026", mode: "classic" });
      await db.doc("groups/g/gameSeasons/PD-2026/predictions/alice_1").set({
        userId: "alice",
        matchId: "1",
        roundId: normalize(raw(1), "PD").roundId,
        value: "1",
      });
      await recompute(db, cache);
      const untouched = await db.doc("matches/2").get();
      cache = await syncCalendars(db, "PD", [finished(2, 1), raw(2)]);
      await recompute(db, cache);
      expect((await db.doc("matches/2").get()).updateTime).toEqual(
        untouched.updateTime,
      );
      const standing = db.doc("groups/g/gameSeasons/PD-2026/standings/alice");
      expect((await standing.get()).data()?.points).toBe(1);
      const queries = vi.spyOn(Query.prototype, "get");
      const docs = vi.spyOn(db, "getAll");
      await recompute(db, cache);
      expect(
        queries.mock.contexts.map((q) =>
          q instanceof CollectionReference ? q.path : "filtered query",
        ),
      ).toEqual(["groups", "groups/g/gameSeasons"]);
      expect(docs).not.toHaveBeenCalled();
    });
    it("recalcula correcciones y altas/bajas sin duplicar puntos ni consultar el calendario individual", async () => {
      let cache = await syncCalendars(db, "PD", [finished(2, 1)]);
      const season = db.doc("groups/g/gameSeasons/PD-2026");
      await db.doc("groups/g").set({ memberIds: ["alice"] });
      await season.set({
        competition: "PD",
        seasonId: "PD-2026",
        mode: "classic",
      });
      for (const [uid, value] of [
        ["alice", "1"],
        ["bob", "2"],
      ])
        await season
          .collection("predictions")
          .doc(`${uid}_1`)
          .set({
            userId: uid,
            matchId: "1",
            roundId: normalize(raw(1), "PD").roundId,
            value,
          });
      await recompute(db, cache);
      expect(
        (await season.collection("standings").doc("alice").get()).data()
          ?.points,
      ).toBe(1);
      await db.doc("groups/g").update({ memberIds: ["alice", "bob"] });
      await recompute(db, cache);
      expect(
        (await season.collection("standings").doc("bob").get()).data()?.points,
      ).toBe(0);
      cache = await syncCalendars(db, "PD", [finished(0, 1)]);
      await recompute(db, cache);
      expect(
        (await season.collection("standings").doc("alice").get()).data()
          ?.points,
      ).toBe(0);
      expect(
        (await season.collection("standings").doc("bob").get()).data()?.points,
      ).toBe(1);
      await db.doc("groups/g").update({ memberIds: ["bob"] });
      await recompute(db, cache);
      expect(
        (await season.collection("standings").doc("alice").get()).exists,
      ).toBe(false);
      expect(
        (await season.collection("standings").doc("bob").get()).data()?.points,
      ).toBe(1);
    });
    it("migra una temporada histórica una sola vez y luego usa su documento agregado", async () => {
      const archived = { ...normalize(raw(1), "PD"), seasonId: "PD-2025" };
      await db.doc("matches/1").set(archived);
      const collections = vi.spyOn(db, "collection");
      expect(await scoringCalendar(db, "PD-2025", new Map())).toHaveLength(1);
      expect(collections).toHaveBeenCalledWith("matches");
      collections.mockClear();
      expect(await scoringCalendar(db, "PD-2025", new Map())).toHaveLength(1);
      expect(collections).not.toHaveBeenCalled();
    });
    it("tras un fallo parcial conserva el calendario publicado y reintenta los cambios de forma segura", async () => {
      await syncCalendars(db, "PD", [raw(1)]);
      const before = (await db.doc("calendars/PD-2026").get()).data()!;
      const batch = db.batch();
      const commit = batch.commit.bind(batch);
      vi.spyOn(batch, "commit").mockImplementationOnce(async () => {
        await commit();
        throw new Error("interrupted");
      });
      vi.spyOn(db, "batch").mockReturnValueOnce(batch);
      await expect(syncCalendars(db, "PD", [finished(1, 0)])).rejects.toThrow(
        "interrupted",
      );
      expect((await db.doc("calendars/PD-2026").get()).data()?.payload).toBe(
        before.payload,
      );
      await syncCalendars(db, "PD", [finished(1, 0)]);
      expect(
        decodeCalendar((await db.doc("calendars/PD-2026").get()).data()!)[0]
          .homeScore,
      ).toBe(1);
    });
    it("rechaza un calendario que excede el límite antes de escribir partidos", async () => {
      const large = { ...raw(1), homeTeam: { name: "x".repeat(800_000) } };
      const batch = vi.spyOn(db, "batch");
      await expect(syncCalendars(db, "PD", [large])).rejects.toThrow(
        "demasiado grande",
      );
      expect(batch).not.toHaveBeenCalled();
    });
    it("puntúa solo las entregas completas nuevas y usa la copia inmutable, no el borrador", async () => {
      const policies = new Map<string, string>();
      const cache = await syncCalendars(db, "PD", [finished(2, 1)], policies);
      const rid = normalize(raw(1), "PD").roundId;
      const season = db.doc("groups/g/gameSeasons/PD-2026");
      await db.doc("groups/g").set({ memberIds: ["alice", "bob"] });
      await season.set({
        competition: "PD",
        seasonId: "PD-2026",
        mode: "classic",
      });
      for (const uid of ["alice", "bob"])
        await season
          .collection("predictions")
          .doc(`${uid}_1`)
          .set({ userId: uid, matchId: "1", roundId: rid, value: "2" });
      await season
        .collection("roundEntries")
        .doc(rid)
        .collection("players")
        .doc("alice")
        .set({
          userId: "alice",
          roundId: rid,
          formatVersion: 2,
          submittedAt: Timestamp.now(),
          ...encodeDelivery("classic", ["1"], { "1": "1" }),
        });
      await recompute(db, cache, policies);
      expect(
        (await season.collection("standings").doc("alice").get()).data()
          ?.points,
      ).toBe(1);
      expect(
        (await season.collection("standings").doc("bob").get()).data()?.points,
      ).toBe(0);
    });
    it("convierte cierres antiguos completos una sola vez y no publica los incompletos", async () => {
      const cache = await syncCalendars(db, "PD", [raw(1), raw(2)]);
      const rid = normalize(raw(1), "PD").roundId;
      const season = db.doc("groups/g/gameSeasons/PD-2026");
      await db.doc("groups/g").set({ memberIds: ["alice", "bob"] });
      await season.set({
        competition: "PD",
        seasonId: "PD-2026",
        mode: "classic",
      });
      for (const uid of ["alice", "bob"])
        await season
          .collection("submissions")
          .doc(uid)
          .collection("rounds")
          .doc(rid)
          .set({ userId: uid, roundId: rid, submittedAt: Timestamp.now() });
      for (const [uid, ids] of [
        ["alice", ["1", "2"]],
        ["bob", ["1"]],
      ] as const)
        for (const matchId of ids)
          await season
            .collection("predictions")
            .doc(`${uid}_${matchId}`)
            .set({ userId: uid, matchId, roundId: rid, value: "X" });
      await recompute(db, cache);
      const entries = season
        .collection("roundEntries")
        .doc(rid)
        .collection("players");
      expect(
        decodeDelivery((await entries.doc("alice").get()).data()!),
      ).toEqual({ "1": "X", "2": "X" });
      expect((await entries.doc("bob").get()).exists).toBe(false);
      expect(
        Object.keys(
          (await season.collection("roundAttendance").doc(rid).get()).data()!
            .members,
        ),
      ).toEqual(["alice"]);
      const queries = vi.spyOn(Query.prototype, "get");
      await recompute(db, cache);
      expect(queries).toHaveBeenCalledTimes(2);
    });
    it("conserva la puntuación de jornadas que ya habían empezado al activar las nuevas entregas", async () => {
      const policies = new Map<string, string>();
      const cache = await syncCalendars(
        db,
        "PD",
        [{ ...finished(2, 1), utcDate: "2026-01-01T19:00:00Z" }],
        policies,
      );
      const season = db.doc("groups/g/gameSeasons/PD-2026");
      await db.doc("groups/g").set({ memberIds: ["alice"] });
      await season.set({
        competition: "PD",
        seasonId: "PD-2026",
        mode: "classic",
      });
      await season
        .collection("predictions")
        .doc("alice_1")
        .set({
          userId: "alice",
          matchId: "1",
          roundId: normalize(raw(1), "PD").roundId,
          value: "1",
        });
      await recompute(db, cache, policies);
      expect(
        (await season.collection("standings").doc("alice").get()).data()
          ?.points,
      ).toBe(1);
    });
  },
);
