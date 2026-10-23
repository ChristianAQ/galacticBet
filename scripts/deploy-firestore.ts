import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

async function deploy() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!raw || !projectId)
    throw new Error(
      "Configura el Secret FIREBASE_SERVICE_ACCOUNT y la Variable VITE_FIREBASE_PROJECT_ID antes de publicar las reglas.",
    );
  let account: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Revisa el Secret sin mostrar su contenido.",
    );
  }
  if (
    !account ||
    account.project_id !== projectId ||
    !account.client_email ||
    !account.private_key
  ) {
    throw new Error(
      "La cuenta de servicio no es válida o pertenece a otro proyecto Firebase. Comprueba que coincide con VITE_FIREBASE_PROJECT_ID.",
    );
  }
  const folder = await mkdtemp(join(tmpdir(), "galacticbet-firebase-"));
  try {
    const credentials = join(folder, "credentials.json");
    await writeFile(credentials, raw, { mode: 0o600, flag: "wx" });
    const cli = fileURLToPath(
      new URL(
        "../node_modules/firebase-tools/lib/bin/firebase.js",
        import.meta.url,
      ),
    );
    const status = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          cli,
          "deploy",
          "--only",
          "firestore:rules,firestore:indexes",
          "--project",
          projectId,
          "--non-interactive",
        ],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            GOOGLE_APPLICATION_CREDENTIALS: credentials,
            FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1",
          },
        },
      );
      child.once("error", () =>
        reject(
          new Error("No se pudo iniciar la CLI de Firebase. Comprueba npm ci."),
        ),
      );
      child.once("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = status;
    if (status !== 0)
      console.error(
        "No se publicarán los cambios de la web hasta desplegar las reglas. Revisa los permisos de la cuenta de servicio para publicar reglas e índices.",
      );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
try {
  await deploy();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudieron publicar las reglas de Firestore.",
  );
  process.exitCode = 1;
}
