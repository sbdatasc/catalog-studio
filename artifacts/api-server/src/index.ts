import app from "./app";
import { logger } from "./lib/logger";
import { openDatabase, closeDatabase } from "./db/connection";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  try {
    await openDatabase();
  } catch (err) {
    logger.error({ err }, "Database initialisation failed — halting");
    process.exit(1);
  }

  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    server.close(async () => {
      await closeDatabase();
      logger.info("Server shut down cleanly");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
