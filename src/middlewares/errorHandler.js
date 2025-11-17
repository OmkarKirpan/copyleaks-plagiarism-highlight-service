const { AppError } = require("../errors/custom-errors");
const { ZodError } = require("zod");

function notFoundHandler(request, reply) {
  reply.code(404).send({
    error: "Not found",
    path: request.raw.url,
    requestId: request.id,
  });
}

function errorHandler(error, request, reply) {
  // Log error with context
  request.log.error({ err: error, requestId: request.id }, "Request error");

  // Handle Fastify validation errors (Zod validation wrapped by Fastify)
  if (error.code === "FST_ERR_VALIDATION" && error.validation) {
    const formattedErrors = error.validation.map((err) => ({
      path: err.instancePath.replace(/^\//, "").replace(/\//g, ".") || err.schemaPath,
      message: err.message,
    }));

    return reply.code(400).send({
      error: "Validation failed",
      details: formattedErrors,
      requestId: request.id,
    });
  }

  // Handle Zod validation errors (direct ZodError)
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));

    return reply.code(400).send({
      error: "Validation failed",
      details: formattedErrors,
      requestId: request.id,
    });
  }

  // Handle custom application errors
  if (error instanceof AppError) {
    const response = {
      error: error.message,
      requestId: request.id,
    };

    if (error.details) {
      response.details = error.details;
    }

    if (error.retryable !== undefined) {
      response.retryable = error.retryable;
    }

    return reply.code(error.statusCode).send(response);
  }

  // Handle Fastify errors
  const status = error.statusCode || error.status || 500;

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === "production";
  const errorMessage =
    status >= 500 && isProduction
      ? "Internal server error"
      : error.message || "Internal server error";

  if (!reply.sent) {
    reply.code(status).send({
      error: errorMessage,
      requestId: request.id,
    });
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
