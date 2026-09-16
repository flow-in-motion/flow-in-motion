import { defineConfig } from "drizzle-kit";

const sslMode =
  process.env.POSTGRES_MIGRATION_SSL_MODE ??
  process.env.POSTGRES_SSL_MODE ??
  "require";
const ssl =
  sslMode === "disable"
    ? false
    : sslMode === "verify-full"
      ? {
          rejectUnauthorized: true,
          ca: (
            process.env.POSTGRES_MIGRATION_SSL_CA ?? process.env.POSTGRES_SSL_CA
          )?.replace(/\\n/g, "\n"),
        }
      : { rejectUnauthorized: false };

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./sql",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.POSTGRES_MIGRATION_HOST ?? process.env.POSTGRES_HOST!,
    port: Number(
      process.env.POSTGRES_MIGRATION_PORT ?? process.env.POSTGRES_PORT,
    ),
    user: process.env.POSTGRES_MIGRATION_USER!,
    password: process.env.POSTGRES_MIGRATION_PASSWORD!,
    database: process.env.POSTGRES_DB!,
    ssl,
  },
});
