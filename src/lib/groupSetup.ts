import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { Mode } from "./domain";

export function gameSeasonId(competition: string) {
  const now = new Date();
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
  return `${competition}-${year}`;
}

export async function createPrivateGroup(
  store: Firestore,
  uid: string,
  name: string,
  mode: Mode,
) {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60)
    throw new Error("El nombre del grupo debe tener entre 3 y 60 caracteres.");
  const group = doc(collection(store, "groups"));
  const batch = writeBatch(store);
  batch.set(group, {
    name: trimmed,
    ownerId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });
  batch.set(doc(group, "members", uid), {
    userId: uid,
    joinedAt: serverTimestamp(),
  });
  for (const competition of ["PD", "CL"]) {
    const seasonId = gameSeasonId(competition);
    batch.set(doc(group, "gameSeasons", seasonId), {
      competition,
      seasonId,
      mode,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return group.id;
}

// Add only missing current seasons. Existing rules and predictions remain immutable.
export async function prepareGroupCompetitions(
  store: Firestore,
  uid: string,
  groupId: string,
) {
  const group = doc(store, "groups", groupId);
  const refs = ["PD", "CL"].map((c) =>
    doc(group, "gameSeasons", gameSeasonId(c)),
  );
  await runTransaction(store, async (tx) => {
    const snapshot = await tx.get(group);
    if (!snapshot.exists() || snapshot.data().ownerId !== uid)
      throw new Error(
        "Solo el administrador puede preparar las competiciones del grupo.",
      );
    const seasons = await Promise.all(refs.map((ref) => tx.get(ref)));
    const existing = seasons.find((s) => s.exists());
    const mode = existing?.data()?.mode === "exact" ? "exact" : "classic";
    seasons.forEach((season, i) => {
      if (!season.exists())
        tx.set(refs[i], {
          competition: i === 0 ? "PD" : "CL",
          seasonId: refs[i].id,
          mode,
          createdAt: serverTimestamp(),
        });
    });
  });
}
