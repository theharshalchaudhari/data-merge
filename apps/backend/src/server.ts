import {
  createApp
} from "./app.js";

import {
  checkDatabaseConnection,
  closeDatabase
} from "./db/client.js";

import {
  initializeStorage
} from "./storage/init.js";

import {
  env
} from "./config/env.js";

const app =
  createApp();

async function start(): Promise<void> {
  try {
    await initializeStorage();

    await checkDatabaseConnection();

    await app.listen({
      host: "0.0.0.0",
      port: env.BACKEND_PORT
    });

    app.log.info(
      `Backend running on port ${env.BACKEND_PORT}`
    );
  } catch (error) {
    app.log.error(
      error,
      "Failed to start backend"
    );

    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  try {
    await app.close();

    await closeDatabase();
  } finally {
    process.exit(0);
  }
}

process.once(
  "SIGINT",
  shutdown
);

process.once(
  "SIGTERM",
  shutdown
);

await start();