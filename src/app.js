const Fastify = require("fastify");
const crypto = require("node:crypto");
const { serializerCompiler, validatorCompiler } = require("fastify-type-provider-zod");
const gracefulShutdown = require("fastify-graceful-shutdown");
const config = require("./config");
const plagiarismRoutes = require("./routes/plagiarismRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");

function buildServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: isProduction
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
            },
          },
    },
    bodyLimit: 25 * 1024 * 1024,
    genReqId: (req) => req.headers["x-request-id"] || crypto.randomUUID(),
  });

  // Set Zod as the validator and serializer
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register request context for correlation IDs
  app.register(require("@fastify/request-context"));

  // Register graceful shutdown plugin (must be before routes)
  app.register(gracefulShutdown, {
    timeout: 30000, // 30 seconds to drain connections
  });

  // Register Swagger documentation
  app.register(require("@fastify/swagger"), {
    openapi: {
      info: {
        title: "Plagiarism Highlight Service API",
        description: "Fastify microservice for Copyleaks plagiarism scanning with highlights",
        version: "1.0.0",
      },
      servers: [
        {
          url: config.webhookBaseUrl || "http://localhost:4000",
          description: "Development server",
        },
      ],
      tags: [
        { name: "plagiarism", description: "Plagiarism scanning endpoints" },
        { name: "webhook", description: "Copyleaks webhook endpoints" },
        { name: "health", description: "Health check endpoints" },
      ],
    },
  });

  // Register Swagger UI
  app.register(require("@fastify/swagger-ui"), {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        description: "Health check endpoint",
      },
    },
    async () => ({
      status: "ok",
      service: "plagiarism-highlight-service",
      environment: config.env,
      webhookBaseUrl: config.webhookBaseUrl,
    })
  );

  app.register(plagiarismRoutes, { prefix: "/plagiarism" });
  app.register(webhookRoutes, { prefix: "/webhook" });

  app.setNotFoundHandler(notFoundHandler);
  app.setErrorHandler(errorHandler);

  return app.withTypeProvider();
}

module.exports = buildServer;
