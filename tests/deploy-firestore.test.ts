import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
function run(account: string, projectId = "demo-project") {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", resolve("scripts/deploy-firestore.ts")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_SERVICE_ACCOUNT: account,
        FIREBASE_PROJECT_ID: projectId,
      },
      timeout: 10000,
    },
  );
}
it("rechaza configuración ausente antes de iniciar una publicación", () => {
  const r = run("");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("Configura el Secret");
});
it("no imprime valores privados al recibir un JSON inválido", () => {
  const r = run("PRIVATE_MARKER_DO_NOT_LOG");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("JSON válido");
  expect(r.stdout + r.stderr).not.toContain("PRIVATE_MARKER_DO_NOT_LOG");
});
it("impide desplegar reglas en un proyecto distinto al del frontend", () => {
  const r = run(
    JSON.stringify({
      project_id: "otro-proyecto",
      client_email: "test@example.test",
      private_key: "PRIVATE_MARKER_DO_NOT_LOG",
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("otro proyecto");
  expect(r.stdout + r.stderr).not.toContain("PRIVATE_MARKER_DO_NOT_LOG");
});
