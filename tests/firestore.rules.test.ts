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
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
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
      for (const [id, offset] of [
        ["future", 3600000],
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
  it("permite crear grupo con membresía y temporada en un lote", async () => {
    const db = env.authenticatedContext("charlie").firestore();
    const b = writeBatch(db);
    b.set(doc(db, "groups/new"), {
      name: "Grupo nuevo",
      ownerId: "charlie",
      memberIds: ["charlie"],
      createdAt: serverTimestamp(),
    });
    b.set(doc(db, "groups/new/members/charlie"), {
      userId: "charlie",
      joinedAt: serverTimestamp(),
    });
    b.set(doc(db, "groups/new/gameSeasons/PD-2026"), {
      competition: "PD",
      seasonId: "PD-2026",
      mode: "exact",
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
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
});
