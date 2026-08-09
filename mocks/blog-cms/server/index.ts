import { serve } from "@hono/node-server";
import { rootLogger } from "../shared/logger";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { seedIfEmpty } from "./db/seed";

const logger = rootLogger.child("server");

async function main(): Promise<void> {
  const dbPath =
    process.env.DATABASE_PATH ?? new URL("./db/data/blog-cms.db", import.meta.url).pathname;
  const db = createDb(dbPath);
  await seedIfEmpty(db);

  const app = createApp(db);
  const port = Number(process.env.PORT ?? 8787);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, "Started the blog-cms API.");
  });
}

main().catch((error: unknown) => {
  logger.error(
    { reason: error instanceof Error ? error.message : String(error) },
    "Failed to start the API.",
  );
  process.exitCode = 1;
});
