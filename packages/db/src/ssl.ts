import fs from "node:fs";
import type { PoolConfig } from "pg";

/**
 * Build SSL config from DB_SSL env var.
 *   'false'     → undefined (no SSL)
 *   'true'      → { rejectUnauthorized: true, ca?: Buffer } (verify CA)
 *   'no-verify' → { rejectUnauthorized: false } (encrypt, skip CA check)
 */
export function buildSslConfig(): PoolConfig["ssl"] {
  const mode = process.env.DB_SSL ?? "false";
  if (mode === "false") return undefined;
  if (mode === "no-verify") return { rejectUnauthorized: false };
  const caPath = process.env.DB_SSL_CA_PATH;
  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: fs.readFileSync(caPath, "utf8") } : {}),
  };
}
