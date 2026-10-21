import { useState } from "react";
/** Public provider emblems; local wordmarks remain visible if the image is unavailable. */
export default function CompetitionLogo({
  code,
  small = false,
}: {
  code: string;
  small?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span
      className={`competition-logo ${code === "CL" ? "champions" : "laliga"} ${small ? "small" : ""}`}
      aria-label={code === "CL" ? "UEFA Champions League" : "LaLiga"}
    >
      <img
        className={`official-emblem ${loaded ? "loaded" : ""}`}
        src={`https://crests.football-data.org/${code}.png`}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
      {!loaded &&
        (code === "CL" ? (
          <>
            <span className="starball">✦</span>
            <span>
              UEFA
              <br />
              CHAMPIONS
              <br />
              LEAGUE
            </span>
          </>
        ) : (
          <>
            <span className="ll-mark">LL</span>
            <strong>LALIGA</strong>
          </>
        ))}
    </span>
  );
}
