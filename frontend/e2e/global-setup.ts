import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The global setup of the end-to-end tests.
 *
 * It prepares the database: creates it when it does not exist, applies
 * the migrations (the test suite builds its schema from the metadata -
 * the E2E proves that the migrations are enough) and seeds the member,
 * the admin, the verse and the quiz of the golden paths.
 *
 * The script is the same one the CI uses, so both paths prepare the
 * database in exactly the same way.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../../backend");

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backend,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
      }
    });
  });
}

export default async function globalSetup(): Promise<void> {
  const python =
    process.env.E2E_PYTHON ?? path.join(backend, ".venv/bin/python");
  const databaseUrl =
    process.env.E2E_DATABASE_URL ??
    "postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_e2e";

  await run(python, ["scripts/e2e_prepare.py"], {
    E2E_DATABASE_URL: databaseUrl,
    DATABASE_URL: databaseUrl,
    APP_ENV: "test",
    DEBUG: "true",
    JWT_SECRET: "e2e-test-secret-0123456789-0123456789",
    JWT_REFRESH_SECRET: "e2e-test-refresh-0123456789-0123456789",
    MAIL_PROVIDER: "console",
    ATTENDANCE_PIN_PEPPER: "e2e-pepper-0123456789-0123456789",
  });
}
