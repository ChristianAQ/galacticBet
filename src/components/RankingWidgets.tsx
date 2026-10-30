import { Crown, Medal, TrendingUp } from "lucide-react";
import { rankingSummary, type RankingRow } from "../lib/rankings";
import "../styles/dashboard.css";

export function RankAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar: string | null;
}) {
  return (
    <span className="rival-avatar">
      {avatar ? (
        <img src={avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function RankBadge({ position }: { position: number }) {
  return (
    <span
      className={`rank-badge${position <= 3 ? ` rank-${position}` : ""}`}
      aria-label={`Posición ${position}`}
    >
      {position}
    </span>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Podium({ rows, userId }: { rows: RankingRow[]; userId: string }) {
  const top = rows.slice(0, 3);
  // Classic podium order: second, first, third.
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <ol className="ranking-podium" aria-label="Podio">
      {order.map((r) => (
        <li
          key={r.id}
          className={`podium-step podium-${r.position}${r.id === userId ? " is-me" : ""}`}
        >
          <span className="podium-avatar">
            <RankAvatar name={r.name} avatar={r.avatar} />
            {r.position === 1 ? (
              <Crown size={16} aria-hidden="true" />
            ) : (
              <Medal size={14} aria-hidden="true" />
            )}
          </span>
          <strong className="podium-name">
            {r.name}
            {r.id === userId && <small> Tú</small>}
          </strong>
          <span className="podium-points">
            {r.points} <small>pts</small>
          </span>
          <span className="podium-block" aria-label={`Posición ${r.position}`}>
            {r.position}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function MyRankCard({
  rows,
  userId,
}: {
  rows: RankingRow[];
  userId: string;
}) {
  const s = rankingSummary(rows, userId);
  if (!s.me) return null;
  const status =
    s.me.position === 1
      ? s.sharedLead
        ? "Compartes el liderato"
        : s.total > 1
          ? `Líder con ${plural(s.me.points - (rows.find((r) => r.position > 1)?.points ?? 0), "punto")} de ventaja`
          : "Líder del grupo"
      : `A ${plural(s.gapToLeader, "punto")} del líder · ${plural(s.gapToAbove, "punto")} para subir`;
  return (
    <section className="my-rank-card" aria-label="Tu posición">
      <span className="my-rank-position">
        <small>Tu posición</small>
        <strong>
          {s.me.position}º<small> de {s.total}</small>
        </strong>
      </span>
      <span className="my-rank-stats">
        <span>
          <strong>{s.me.points}</strong>
          <small>puntos</small>
        </span>
        <span>
          <strong>{s.me.hits}</strong>
          <small>aciertos</small>
        </span>
      </span>
      <p className="my-rank-status">
        <TrendingUp size={14} aria-hidden="true" />
        {status}
      </p>
    </section>
  );
}
