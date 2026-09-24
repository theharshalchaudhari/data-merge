import {
  createApp
} from "./app.js";

import {
  env
} from "./config/env.js";

import {
  checkDatabaseConnection,
  closeDatabase
} from "./db/client.js";

import {
  initializeStorage
} from "./storage/init.js";

async function start() {
  await initializeStorage();

  await checkDatabaseConnection();

  const app =
    await createApp();

  await app.listen({
    host: "0.0.0.0",
    port:
      env.BACKEND_PORT
  });

  async function shutdown() {
    await app.close();
    await closeDatabase();
    process.exit(0);
  }

  process.on(
    "SIGINT",
    shutdown
  );

  process.on(
    "SIGTERM",
    shutdown
  );
}

start().catch(
  (error) => {
    console.error(
      error
    );

    process.exit(1);
  }
);
