import { defineConfig } from "drizzle-kit";
import { buildSslConfig } from "./src/ssl.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: buildSslConfig(),
  },
  verbose: true,
  strict: true,
});
