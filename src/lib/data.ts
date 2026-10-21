import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Match, Mode, Outcome, Prediction } from "./domain";
import { db } from "./firebase";
export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}
function database() {
  if (!db) throw new Error("Firebase no está configurado.");
  return db;
}
export async function loadMatches() {
  const snap = await getDocs(collection(database(), "matches"));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as Match)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}
export async function loadGroups(uid: string) {
  const snap = await getDocs(
    query(
      collection(database(), "groups"),
      where("memberIds", "array-contains", uid),
    ),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Group);
}
export async function createGroup(
  uid: string,
  name: string,
  competition: string,
  mode: Mode,
) {
  const store = database();
  const group = doc(collection(store, "groups"));
  const batch = writeBatch(store);
  batch.set(group, {
    name: name.trim(),
    ownerId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });
  batch.set(doc(group, "members", uid), {
    userId: uid,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(group, "gameSeasons", gameSeasonId(competition)), {
    competition,
    seasonId: gameSeasonId(competition),
    mode,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return group.id;
}
export async function joinGroup(uid: string, code: string) {
  const store = database();
  const ref = doc(store, "groups", code.trim());
  await runTransaction(store, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists())
      throw new Error("No encontramos ese grupo. Revisa el código.");
    const group = snap.data() as Group;
    if (group.memberIds.includes(uid)) return;
    if (group.memberIds.length >= 30)
      throw new Error("Este grupo ha alcanzado el límite de 30 participantes.");
    transaction.update(ref, { memberIds: [...group.memberIds, uid] });
    transaction.set(doc(ref, "members", uid), {
      userId: uid,
      joinedAt: serverTimestamp(),
    });
  });
}
export async function leaveGroup(uid: string, group: Group) {
  const store = database();
  const ref = doc(store, "groups", group.id);
  await runTransaction(store, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Este grupo ya no existe.");
    const data = snap.data() as Group;
    transaction.update(ref, {
      memberIds: data.memberIds.filter((id) => id !== uid),
    });
    transaction.delete(doc(ref, "members", uid));
  });
}
export async function savePrediction(
  uid: string,
  groupId: string,
  season: string,
  match: Match,
  value: Outcome | Prediction,
) {
  await setDoc(
    doc(
      database(),
      "groups",
      groupId,
      "gameSeasons",
      season,
      "predictions",
      `${uid}_${match.id}`,
    ),
    {
      userId: uid,
      matchId: match.id,
      roundId: match.roundId,
      value,
      updatedAt: serverTimestamp(),
    },
  );
}

export function gameSeasonId(competition: string) {
  const now = new Date();
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
  return `${competition}-${year}`;
}
export async function activateCompetition(
  groupId: string,
  competition: string,
  mode: Mode,
) {
  const seasonId = gameSeasonId(competition);
  await setDoc(doc(database(), "groups", groupId, "gameSeasons", seasonId), {
    competition,
    seasonId,
    mode,
    createdAt: serverTimestamp(),
  });
}
export async function renameGroup(groupId: string, name: string) {
  await updateDoc(doc(database(), "groups", groupId), { name: name.trim() });
}
