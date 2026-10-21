import { ArrowRight, Flag, Target } from "lucide-react";
import type { ReactNode } from "react";
import { matchStatusLabel, type Match } from "../lib/domain";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Target size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export const readableError = (e: unknown) => {
  const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Revisa tu correo y contraseña.",
    "auth/email-already-in-use":
      "Este correo ya tiene una cuenta. Inicia sesión.",
    "auth/weak-password": "Usa una contraseña de al menos 6 caracteres.",
    "auth/popup-closed-by-user":
      "Se cerró la ventana de Google. Puedes volver a intentarlo.",
    "auth/unauthorized-domain":
      "Este dominio aún no está autorizado en Firebase Authentication.",
    "permission-denied":
      "No tienes permiso para esta operación o el partido ya está cerrado.",
    unavailable: "No hay conexión con Firestore. Tu cambio no se ha guardado.",
  };
  return (
    messages[code] ||
    (e instanceof Error
      ? e.message
      : "No se pudo completar la operación. Inténtalo otra vez.")
  );
};
export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function Team({ name, crest }: { name: string; crest?: string }) {
  return (
    <span className="team">
      {crest ? (
        <img
          src={crest}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Flag size={20} />
      )}
      <span>{name}</span>
    </span>
  );
}
export function MatchRow({ match: m }: { match: Match }) {
  return (
    <div className="match-row">
      <span className="match-date">
        {new Intl.DateTimeFormat("es", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Madrid",
        }).format(new Date(m.utcDate))}
      </span>
      <Team name={m.home} crest={m.homeCrest} />
      <span className="match-score">
        {m.homeScore !== null ? `${m.homeScore} : ${m.awayScore}` : "vs"}
      </span>
      <Team name={m.away} crest={m.awayCrest} />
      <span className="match-status">
        {matchStatusLabel[m.status] || m.status}
      </span>
    </div>
  );
}
export function PrivateGate({
  onLogin,
  onDemo,
}: {
  onLogin: () => void;
  onDemo?: () => void;
}) {
  return (
    <Empty title="Tu quiniela te espera">
      <p>
        Inicia sesión para jugar con tus amigos y conservar tus pronósticos en
        todos tus dispositivos.
      </p>
      <button className="button primary" onClick={onLogin}>
        Iniciar sesión <ArrowRight size={16} />
      </button>
      {onDemo && (
        <button className="button secondary" onClick={onDemo}>
          Probar en modo demo
        </button>
      )}
    </Empty>
  );
}
