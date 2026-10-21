import type { User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Empty, PageTitle, PrivateGate, readableError } from "../components/ui";
import { type Group } from "../lib/data";
import { roundLabelFromId } from "../lib/domain";
import { db } from "../lib/firebase";
export default function StandingsPage({
  groups,
  user,
  onLogin,
}: {
  groups: Group[];
  user: User | null;
  onLogin: () => void;
}) {
  const [group, setGroup] = useState("");
  const [rows, setRows] = useState<
    { id: string; name: string; points: number; hits: number }[]
  >([]);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("global");
  const [round, setRound] = useState("");
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  useEffect(() => {
    setRows([]);
    setAvailableRounds([]);
    if (!db || !group) return;
    const store = db;
    let active = true;
    getDocs(collection(store, "groups", group, "gameSeasons"))
      .then(async (seasons) => {
        const map = new Map<
          string,
          { id: string; name: string; points: number; hits: number }
        >();
        const allRounds = new Set<string>();
        for (const s of seasons.docs) {
          if (scope !== "global" && s.data().competition !== scope) continue;
          const standings = await getDocs(collection(s.ref, "standings"));
          for (const d of standings.docs) {
            const v = d.data();
            Object.keys(v.rounds || {}).forEach((r) => allRounds.add(r));
            const item = round
              ? v.rounds?.[round] || { points: 0, hits: 0 }
              : v;
            const prev = map.get(d.id) || {
              id: d.id,
              name: v.name || "Jugador",
              points: 0,
              hits: 0,
            };
            prev.points += item.points || 0;
            prev.hits += item.hits || 0;
            map.set(d.id, prev);
          }
        }
        if (active) {
          setAvailableRounds([...allRounds].sort());
          setRows([...map.values()].sort((a, b) => b.points - a.points));
        }
      })
      .catch((e) => setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [group, scope, round]);
  return (
    <>
      <PageTitle
        eyebrow="CADA ACIERTO SUMA"
        title="La clasificación"
        description="Jornada a jornada, se escribe la historia de vuestro grupo."
      />
      {!user ? (
        <PrivateGate onLogin={onLogin} />
      ) : (
        <>
          <div className="filter-row">
            <select
              aria-label="Grupo"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">Selecciona un grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Clasificación"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setRound("");
              }}
            >
              <option value="global">Global del grupo</option>
              <option value="PD">General LaLiga</option>
              <option value="CL">General Champions</option>
            </select>
            <select
              aria-label="Jornada de clasificación"
              value={round}
              onChange={(e) => setRound(e.target.value)}
            >
              <option value="">Todas las jornadas</option>
              {availableRounds.map((r) => (
                <option key={r} value={r}>
                  {roundLabelFromId(r)}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="panel">
            {rows.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Jugador</th>
                    <th>Aciertos</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="green-text">
                        {rows.findIndex((x) => x.points === r.points) + 1}
                        {r.points === rows[0].points ? " 🏆" : ""}
                      </td>
                      <td>
                        {r.name}
                        {r.id === user.uid ? " (tú)" : ""}
                      </td>
                      <td>{r.hits}</td>
                      <td>
                        <strong>{r.points}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="La gloria todavía está en juego">
                Selecciona un grupo. La clasificación aparecerá cuando se
                sincronicen resultados y se calculen los puntos.
              </Empty>
            )}
          </div>
        </>
      )}
    </>
  );
}
