import type { User } from "firebase/auth";
import { ArrowRight, LogOut, Target, Trophy } from "lucide-react";
import { PageTitle } from "../components/ui";
import { logout } from "../lib/firebase";
export default function ProfilePage({
  user,
  onLogin,
}: {
  user: User | null;
  onLogin: () => void;
}) {
  return (
    <>
      <PageTitle
        eyebrow="LAS REGLAS DEL JUEGO"
        title={user ? `Hola, ${user.displayName || "jugador"}` : "Así se juega"}
        description="Sin dinero de por medio. Solo intuición, fútbol y rivalidad entre amigos."
      />
      <div className="rules-grid">
        <div className="panel form-panel">
          <Target className="green-text" />
          <h2>Quiniela clásica</h2>
          <p>1 si gana el local, X para el empate y 2 si gana el visitante.</p>
          <h3>1 punto por acierto</h3>
          <p>Un fallo suma 0 puntos. Sencillo y emocionante.</p>
        </div>
        <div className="panel form-panel">
          <Trophy className="green-text" />
          <h2>Marcador exacto</h2>
          <p>
            Pronostica los goles de cada equipo durante el tiempo reglamentario.
          </p>
          <h3>3 puntos por marcador exacto</h3>
          <p>1 punto por ganador o empate. No se acumulan: el máximo es 3.</p>
        </div>
      </div>
      <div className="panel form-panel">
        <h2>Juego limpio, por defecto</h2>
        <p>
          La modalidad queda fija durante la temporada. Puedes editar cada
          pronóstico hasta el inicio del partido o hasta guardar y cerrar la
          quiniela. Los de tus amigos permanecen ocultos hasta ese momento.
        </p>
        <p>
          En las eliminatorias cuentan los 90 minutos más el descuento. La
          prórroga y los penaltis no cuentan.
        </p>
        {user ? (
          <>
            <p>{user.email}</p>
            <button className="button secondary" onClick={() => void logout()}>
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </>
        ) : (
          <button className="button primary" onClick={onLogin}>
            Empezar a jugar <ArrowRight size={16} />
          </button>
        )}
      </div>
    </>
  );
}
