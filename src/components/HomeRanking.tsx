import { ArrowUpRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Group } from "../lib/data";
import { competitionName } from "../lib/competitions";
import { buildRanking, rankingSummary } from "../lib/rankings";
import { useGroupSelection } from "../lib/useGroupSelection";
import { useGroupRankings } from "../lib/useGroupRankings";
import CompetitionLogo from "./CompetitionLogo";
import "../styles/dashboard.css";

export default function HomeRanking({
  userId,
  groups,
}: {
  userId: string;
  groups: Group[];
}) {
  const { groupId, preferences } = useGroupSelection(userId, groups);
  const group = groups.find((g) => g.id === groupId);
  const { data, error, retry } = useGroupRankings(userId, group);
  if (!group) return null;
  const rows = buildRanking(
    data?.participants || [],
    data?.seasons || [],
    preferences.competition,
  );
  const { me, total } = rankingSummary(rows, userId);
  const tied = me && rows.filter((r) => r.position === me.position).length > 1;
  const hasPoints = rows.some((r) => r.points > 0);
  const href = `/clasificacion?vista=grupo&group=${encodeURIComponent(groupId)}&period=all`;
  return (
    <section
      className="home-ranking panel"
      aria-labelledby="home-ranking-title"
      aria-busy={!data && !error}
    >
      <header>
        <div>
          <span className="eyebrow">
            <Trophy size={13} aria-hidden="true" /> TU CLASIFICACIÓN
          </span>
          <h2 id="home-ranking-title">{group.name}</h2>
        </div>
        <CompetitionLogo code={preferences.competition} small />
      </header>
      <p className="home-ranking-context">
        {competitionName(preferences.competition, true)} · Todas las jornadas
      </p>
      {error ? (
        <div className="home-ranking-message" role="status">
          <p>No se pudo actualizar tu clasificación.</p>
          <button type="button" className="text-button" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : !data ? (
        <div className="home-ranking-loading" role="status">
          Cargando tu posición…
        </div>
      ) : me ? (
        <>
          <div className="home-ranking-numbers">
            <div className="home-ranking-position">
              <strong>
                {me.position}
                <span>º</span>
              </strong>
              <span>
                de {total} participantes{tied ? " · Empatado" : ""}
              </span>
            </div>
            <div className="home-ranking-hits">
              <strong>{me.hits}</strong>
              <span>
                {me.hits === 1 ? "partido acertado" : "partidos acertados"}
              </span>
            </div>
          </div>
          {!hasPoints && (
            <p className="home-ranking-note">
              Todos empezáis con 0 puntos. La tabla se actualizará al puntuar
              los partidos.
            </p>
          )}
        </>
      ) : (
        <p className="home-ranking-note">
          Tu posición aparecerá al actualizar los participantes del grupo.
        </p>
      )}
      <Link className="home-ranking-link" to={href}>
        Ver mi clasificación
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
