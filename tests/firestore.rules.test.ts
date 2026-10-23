import {
  createPrivateGroup,
  prepareGroupCompetitions,
  gameSeasonId,
} from "../src/lib/groupSetup";
import { sealRound } from "../src/lib/roundSubmission";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)("Firestore: permisos reales del backend", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-galacticbet",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "groups/g"), {
        name: "Amigos",
        ownerId: "alice",
        memberIds: ["alice", "bob"],
      });
      await setDoc(doc(db, "groups/g/gameSeasons/PD-2026"), {
        competition: "PD",
        seasonId: "PD-2026",
        mode: "classic",
      });
      for (const rid of ["r", "r2"])
        await setDoc(doc(db, `rounds/${rid}`), { seasonId: "PD-2026" });
      for (const [id, offset] of [
        ["future", 3600000],
        ["future2", 7200000],
        ["closed", -3600000],
      ] as const)
        await setDoc(doc(db, `matches/${id}`), {
          competition: "PD",
          seasonId: "PD-2026",
          roundId: "r",
          kickoffAt: Timestamp.fromMillis(Date.now() + offset),
          status: "TIMED",
        });
      for (const matchId of ["future", "closed"])
        await setDoc(
          doc(db, `groups/g/gameSeasons/PD-2026/predictions/bob_${matchId}`),
          {
            userId: "bob",
            matchId,
            roundId: "r",
            value: "X",
            updatedAt: Timestamp.now(),
          },
        );
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  const prediction = (id: string, uid = "alice") => ({
    userId: uid,
    matchId: id,
    roundId: "r",
    value: "1",
    updatedAt: serverTimestamp(),
  });
  it("permite guardar antes del inicio", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"),
        prediction("future"),
      ),
    );
  });
  it("permite leer calendarios agregados públicos pero nunca escribir resultados desde el cliente", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "calendars/PD-2026"), {
        formatVersion: 1,
        seasonId: "PD-2026",
        payload: "[]",
      }),
    );
    const anonymous = env.unauthenticatedContext().firestore();
    expect(
      (await assertSucceeds(getDocs(collection(anonymous, "calendars")))).size,
    ).toBe(1);
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      updateDoc(doc(db, "calendars/PD-2026"), { payload: "fake" }),
    );
    await assertFails(
      setDoc(doc(db, "calendars/CL-2026"), { payload: "fake" }),
    );
    await assertFails(
      updateDoc(doc(db, "matches/future"), { status: "FINISHED" }),
    );
  });
  it("permite consultar solo los pronósticos propios de la jornada sin revelar los ajenos", async () => {
    const db = env.authenticatedContext("bob").firestore();
    const ref = collection(db, "groups/g/gameSeasons/PD-2026/predictions");
    const own = await assertSucceeds(
      getDocs(
        query(ref, where("userId", "==", "bob"), where("roundId", "==", "r")),
      ),
    );
    expect(own.size).toBe(2);
    await assertFails(
      getDocs(
        query(ref, where("userId", "==", "alice"), where("roundId", "==", "r")),
      ),
    );
  });
  it("rechaza crear o editar después del inicio", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_closed"),
        prediction("closed"),
      ),
    );
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(
      setDoc(
        doc(bob, "groups/g/gameSeasons/PD-2026/predictions/bob_closed"),
        prediction("closed", "bob"),
      ),
    );
  });
  it("oculta ajenos hasta el inicio, incluso por lectura directa", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      getDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/bob_future")),
    );
    await assertSucceeds(
      getDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/bob_closed")),
    );
    const ref = collection(db, "groups/g/gameSeasons/PD-2026/predictions");
    await assertSucceeds(getDocs(query(ref, where("matchId", "==", "closed"))));
    await assertFails(getDocs(query(ref, where("matchId", "==", "future"))));
  });
  it("permite consultar los propios, impide listar todos los abiertos", async () => {
    const db = env.authenticatedContext("bob").firestore();
    const ref = collection(db, "groups/g/gameSeasons/PD-2026/predictions");
    await assertSucceeds(getDocs(query(ref, where("userId", "==", "bob"))));
    await assertFails(getDocs(ref));
  });
  it("impide suplantación, puntos enviados y autoasignación de admin", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(db, "groups/g"), { ownerId: "bob" }));
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/standings/bob"), {
        points: 999,
      }),
    );
    await assertFails(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"),
        prediction("future"),
      ),
    );
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/bob_future"), {
        ...prediction("future", "bob"),
        points: 3,
      }),
    );
  });
  it("fija modalidad incluso para el administrador", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(
      updateDoc(doc(db, "groups/g/gameSeasons/PD-2026"), { mode: "exact" }),
    );
  });
  it("impide lecturas de no miembros", async () => {
    const db = env.authenticatedContext("outsider").firestore();
    await assertFails(
      getDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/bob_closed")),
    );
    await assertFails(
      getDocs(collection(db, "groups/g/gameSeasons/PD-2026/standings")),
    );
  });
  it("crea un grupo con membresía y ambas competiciones en el mismo lote", async () => {
    const db = env.authenticatedContext("charlie").firestore();
    const id = await createPrivateGroup(
      doc(db, "groups/g").firestore,
      "charlie",
      "  Grupo nuevo  ",
      "exact",
    );
    expect((await getDoc(doc(db, `groups/${id}`))).data()?.name).toBe(
      "Grupo nuevo",
    );
    expect(
      (await getDoc(doc(db, `groups/${id}/members/charlie`))).exists(),
    ).toBe(true);
    for (const competition of ["PD", "CL"]) {
      const season = await getDoc(
        doc(db, `groups/${id}/gameSeasons/${gameSeasonId(competition)}`),
      );
      expect(season.data()).toMatchObject({
        competition,
        seasonId: gameSeasonId(competition),
        mode: "exact",
      });
    }
  });
  it("prepara grupos antiguos de forma idempotente sin modificar modalidades fijadas", async () => {
    const sid = gameSeasonId("PD");
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), `groups/g/gameSeasons/${sid}`), {
        competition: "PD",
        seasonId: sid,
        mode: "exact",
      }),
    );
    const db = env.authenticatedContext("alice").firestore();
    const store = doc(db, "groups/g").firestore;
    await prepareGroupCompetitions(store, "alice", "g");
    const path = `groups/g/gameSeasons/${gameSeasonId("CL")}`;
    const first = (await getDoc(doc(db, path))).data();
    expect(first?.mode).toBe("exact");
    await prepareGroupCompetitions(store, "alice", "g");
    expect((await getDoc(doc(db, path))).data()).toEqual(first);
    expect(
      (await getDoc(doc(db, `groups/g/gameSeasons/${sid}`))).data()?.mode,
    ).toBe("exact");
  });
  it("conserva modalidades distintas ya existentes y no permite preparar grupos ajenos", async () => {
    const pd = gameSeasonId("PD"),
      cl = gameSeasonId("CL");
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `groups/g/gameSeasons/${pd}`), {
        competition: "PD",
        seasonId: pd,
        mode: "classic",
      });
      await setDoc(doc(c.firestore(), `groups/g/gameSeasons/${cl}`), {
        competition: "CL",
        seasonId: cl,
        mode: "exact",
      });
    });
    const db = env.authenticatedContext("alice").firestore();
    await prepareGroupCompetitions(doc(db, "groups/g").firestore, "alice", "g");
    expect(
      (await getDoc(doc(db, `groups/g/gameSeasons/${pd}`))).data()?.mode,
    ).toBe("classic");
    expect(
      (await getDoc(doc(db, `groups/g/gameSeasons/${cl}`))).data()?.mode,
    ).toBe("exact");
    const bob = env.authenticatedContext("bob").firestore();
    await expect(
      prepareGroupCompetitions(doc(bob, "groups/g").firestore, "bob", "g"),
    ).rejects.toThrow("Solo el administrador");
    await assertFails(
      setDoc(doc(bob, "groups/g/gameSeasons/CL-2099"), {
        competition: "CL",
        seasonId: "CL-2099",
        mode: "exact",
        createdAt: serverTimestamp(),
      }),
    );
  });
  it("permite guardar el nombre propio pero nunca editar el perfil de otro usuario", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/alice"), {
        name: "Ana",
        avatar: null,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, "users/bob"), {
        name: "Nombre suplantado",
        avatar: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("solo permite añadirse a sí mismo sin promover a nadie", async () => {
    const db = env.authenticatedContext("charlie").firestore();
    await assertFails(
      updateDoc(doc(db, "groups/g"), {
        memberIds: ["alice", "bob", "charlie", "eve"],
      }),
    );
    await assertFails(
      updateDoc(doc(db, "groups/g"), {
        memberIds: ["alice", "bob", "charlie"],
      }),
    );
    const batch = writeBatch(db);
    batch.update(doc(db, "groups/g"), {
      memberIds: ["alice", "bob", "charlie"],
    });
    batch.set(doc(db, "groups/g/members/charlie"), {
      userId: "charlie",
      joinedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it("confirma exactamente las elecciones revisadas y bloquea todo el resto de la jornada", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await setDoc(
      doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"),
      prediction("future"),
    );
    await sealRound(
      doc(db, "groups/g").firestore,
      "alice",
      "g",
      "PD-2026",
      "r",
      { future: "1" },
    );
    const ref = doc(
      db,
      "groups/g/gameSeasons/PD-2026/submissions/alice/rounds/r",
    );
    expect((await getDoc(ref)).exists()).toBe(true);
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"), {
        ...prediction("future"),
        value: "X",
      }),
    );
    await assertFails(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future2"),
        prediction("future2"),
      ),
    );
    // Other players remain free to complete their own round.
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(
        doc(bob, "groups/g/gameSeasons/PD-2026/predictions/bob_future2"),
        prediction("future2", "bob"),
      ),
    );
  });
  it("rechaza confirmar un resumen antiguo tras un cambio desde otro dispositivo", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await setDoc(
      doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"),
      { ...prediction("future"), value: "X" },
    );
    await expect(
      sealRound(doc(db, "groups/g").firestore, "alice", "g", "PD-2026", "r", {
        future: "1",
      }),
    ).rejects.toThrow("otro dispositivo");
    expect(
      (
        await getDoc(
          doc(db, "groups/g/gameSeasons/PD-2026/submissions/alice/rounds/r"),
        )
      ).exists(),
    ).toBe(false);
  });
  it("un cierre no puede borrarse ni modificarse, tampoco por el administrador", async () => {
    const db = env.authenticatedContext("bob").firestore();
    const path = "groups/g/gameSeasons/PD-2026/submissions/bob/rounds/r";
    await assertSucceeds(
      setDoc(doc(db, path), {
        userId: "bob",
        roundId: "r",
        submittedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(db, path)));
    await assertFails(
      updateDoc(doc(db, path), { submittedAt: serverTimestamp() }),
    );
    const owner = env.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(owner, path)));
  });
  it("impide cerrar por otro usuario, falsificar la fecha o usar una ronda de otra temporada", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/submissions/alice/rounds/r"),
        { userId: "alice", roundId: "r", submittedAt: serverTimestamp() },
      ),
    );
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/submissions/bob/rounds/r"), {
        userId: "bob",
        roundId: "r",
        submittedAt: Timestamp.fromMillis(1),
      }),
    );
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "rounds/other"), { seasonId: "CL-2026" }),
    );
    await assertFails(
      setDoc(
        doc(db, "groups/g/gameSeasons/PD-2026/submissions/bob/rounds/other"),
        { userId: "bob", roundId: "other", submittedAt: serverTimestamp() },
      ),
    );
  });
  it("una quiniela cerrada conserva la privacidad de los partidos futuros", async () => {
    const bob = env.authenticatedContext("bob").firestore();
    await setDoc(
      doc(bob, "groups/g/gameSeasons/PD-2026/submissions/bob/rounds/r"),
      { userId: "bob", roundId: "r", submittedAt: serverTimestamp() },
    );
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(
      getDoc(doc(alice, "groups/g/gameSeasons/PD-2026/predictions/bob_future")),
    );
    await assertFails(
      getDocs(
        query(
          collection(alice, "groups/g/gameSeasons/PD-2026/predictions"),
          where("matchId", "==", "future"),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(alice, "groups/g/gameSeasons/PD-2026/predictions"),
          where("matchId", "==", "closed"),
        ),
      ),
    );
    for (const status of ["POSTPONED", "CANCELLED"]) {
      await env.withSecurityRulesDisabled((c) =>
        updateDoc(doc(c.firestore(), "matches/closed"), { status }),
      );
      await assertFails(
        getDoc(
          doc(alice, "groups/g/gameSeasons/PD-2026/predictions/bob_closed"),
        ),
      );
    }
  });
  it("no permite esquivar el cierre moviendo un pronóstico a otra ronda", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await setDoc(
      doc(db, "groups/g/gameSeasons/PD-2026/submissions/bob/rounds/r"),
      { userId: "bob", roundId: "r", submittedAt: serverTimestamp() },
    );
    await env.withSecurityRulesDisabled((c) =>
      updateDoc(doc(c.firestore(), "matches/future"), { roundId: "r2" }),
    );
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/bob_future"), {
        ...prediction("future", "bob"),
        roundId: "r2",
      }),
    );
  });

  it("confirma y bloquea también los marcadores exactos", async () => {
    await env.withSecurityRulesDisabled((c) =>
      updateDoc(doc(c.firestore(), "groups/g/gameSeasons/PD-2026"), {
        mode: "exact",
      }),
    );
    const db = env.authenticatedContext("alice").firestore();
    await setDoc(
      doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"),
      { ...prediction("future"), value: { home: 2, away: 1 } },
    );
    await sealRound(
      doc(db, "groups/g").firestore,
      "alice",
      "g",
      "PD-2026",
      "r",
      { future: { away: 1, home: 2 } },
    );
    await assertFails(
      setDoc(doc(db, "groups/g/gameSeasons/PD-2026/predictions/alice_future"), {
        ...prediction("future"),
        value: { home: 2, away: 2 },
      }),
    );
  });
});
