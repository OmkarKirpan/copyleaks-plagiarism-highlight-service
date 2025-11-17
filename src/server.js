const buildServer = require("./app");
const config = require("./config");
const { copyleaksClient } = require("./services/copyleaksService");

async function start() {
  const server = buildServer();

  // Setup graceful shutdown handlers
  server.after(() => {
    server.gracefulShutdown(async (signal) => {
      server.log.info(`Received signal to shutdown: ${signal}`);

      // Cleanup operations (e.g., close DB connections, flush logs, etc.)
      // For now, we just log. Add more cleanup as needed.
      server.log.info("Cleanup completed");
    });
  });

  try {
    await copyleaksClient.login();
    server.log.info("Copyleaks authentication ready");
  } catch (error) {
    server.log.error({ err: error }, "Failed to authenticate with Copyleaks");
    // Continue startup even if Copyleaks auth fails (for local development)
    if (config.env === "production") {
      server.log.fatal("Copyleaks authentication is required in production");
      process.exit(1);
    }
  }

  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
    server.log.info("Plagiarism microservice running", {
      port: config.port,
      env: config.env,
      webhookBaseUrl: config.webhookBaseUrl,
      docsUrl: `http://localhost:${config.port}/docs`,
    });
  } catch (error) {
    server.log.error({ err: error }, "Failed to start Fastify server");
    process.exit(1);
  }

  // Alternative: Manual signal handlers (if not using fastify-graceful-shutdown)
  // const signals = ["SIGINT", "SIGTERM"];
  // for (const signal of signals) {
  //   process.on(signal, async () => {
  //     server.log.info(`Received ${signal}, closing server...`);
  //     await server.close();
  //     process.exit(0);
  //   });
  // }
}

start();
