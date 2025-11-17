/**
 * Base custom error class for the application
 */
class AppError extends Error {
  constructor(message, statusCode = 500, retryable = false) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

/**
 * Error for Copyleaks API failures
 */
class CopyleaksError extends AppError {
  constructor(message, statusCode = 502, retryable = true) {
    super(message, statusCode, retryable);
  }
}

/**
 * Error for validation failures
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, false);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

/**
 * Error for resource not found
 */
class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, false);
  }
}

/**
 * Error for conflicts (e.g., data not ready)
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, false);
  }
}

/**
 * Error for authentication failures
 */
class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, false);
  }
}

module.exports = {
  AppError,
  CopyleaksError,
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
};
