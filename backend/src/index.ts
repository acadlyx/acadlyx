import { createApp } from "./app";
import { assertAuthEnv, env } from "./config/env";
import { logger } from "./utils/logger";

assertAuthEnv();

const app = createApp();

app.listen(env.port, () => {
  logger.info(`ACADLYX API running on http://localhost:${env.port}`);
  logger.info(`Health check: http://localhost:${env.port}/api/${env.apiVersion}/health`);
});
