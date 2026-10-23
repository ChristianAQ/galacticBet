import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { samePrediction, type PredictionValue } from "./domain";
import {
  DELIVERY_VERSION,
  encodeDelivery,
  validDeliveredPicks,
} from "./roundDelivery";

/** Confirm the exact selections the player reviewed, then seal the whole round. */
export async function sealRound(
  store: Firestore,
  uid: string,
  groupId: string,
  seasonId: string,
  roundId: string,
  expected: Record<string, PredictionValue>,
) {
  if (!Object.keys(expected).length)
    throw new Error("Elige al menos un pronóstico antes de guardar.");
  const ref = doc(
    store,
    "groups",
    groupId,
    "gameSeasons",
    seasonId,
    "submissions",
    uid,
    "rounds",
    roundId,
  );
  await runTransaction(store, async (transaction) => {
    if ((await transaction.get(ref)).exists())
      throw new Error("Esta quiniela ya está guardada y cerrada.");
    const [round, game] = await Promise.all([
      transaction.get(doc(store, "rounds", roundId)),
      transaction.get(doc(store, "groups", groupId, "gameSeasons", seasonId)),
    ]);
    if (
      !round.exists() ||
      round.data().seasonId !== seasonId ||
      !validDeliveredPicks(
        game.data()?.mode,
        round.data().requiredMatchIds || [],
        expected,
      )
    )
      throw new Error(
        "Completa todos los partidos disponibles de esta jornada antes de guardar.",
      );
    const entries = Object.entries(expected);
    const snapshots = await Promise.all(
      entries.map(([matchId]) =>
        transaction.get(
          doc(
            store,
            "groups",
            groupId,
            "gameSeasons",
            seasonId,
            "predictions",
            `${uid}_${matchId}`,
          ),
        ),
      ),
    );
    for (let i = 0; i < entries.length; i++) {
      const data = snapshots[i].data();
      if (
        !data ||
        data.roundId !== roundId ||
        !samePrediction(data.value as PredictionValue, entries[i][1])
      ) {
        throw new Error(
          "Tus elecciones han cambiado en otro dispositivo. Revisa la quiniela antes de confirmarla.",
        );
      }
    }
    transaction.set(ref, {
      userId: uid,
      roundId,
      submittedAt: serverTimestamp(),
      formatVersion: DELIVERY_VERSION,
    });
    transaction.set(
      doc(
        store,
        "groups",
        groupId,
        "gameSeasons",
        seasonId,
        "roundEntries",
        roundId,
        "players",
        uid,
      ),
      {
        userId: uid,
        roundId,
        submittedAt: serverTimestamp(),
        formatVersion: DELIVERY_VERSION,
        ...encodeDelivery(
          game.data()!.mode,
          round.data()!.requiredMatchIds,
          expected,
        ),
      },
    );
    transaction.set(
      doc(
        store,
        "groups",
        groupId,
        "gameSeasons",
        seasonId,
        "roundAttendance",
        roundId,
      ),
      {
        members: { [uid]: serverTimestamp() },
      },
      { merge: true },
    );
  });
}
