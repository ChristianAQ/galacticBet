import CompetitionLogo from "./CompetitionLogo";
import type { CompetitionCode } from "../lib/preferences";
export default function CompetitionSwitch({
  value,
  onChange,
  combined = false,
}: {
  value: CompetitionCode;
  onChange: (value: CompetitionCode) => void;
  combined?: boolean;
}) {
  return (
    <div
      className="competition-switch"
      data-competition={value}
      data-combined={combined}
      role="group"
      aria-label="Competición de clasificación"
    >
      {(["PD", "CL"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-label={code === "PD" ? "LaLiga" : "Champions League"}
          aria-pressed={!combined && value === code}
          onClick={() => onChange(code)}
        >
          <CompetitionLogo code={code} small />
          <span>{code === "PD" ? "LaLiga" : "Champions"}</span>
        </button>
      ))}
    </div>
  );
}
