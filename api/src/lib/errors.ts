import type { FastifyError, FastifyInstance } from "fastify";

/** Base for all expected API errors → rendered as { error: { code, message, details? } }. */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "validation", "Validation failed", details);
  }
}
export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(400, "bad_request", message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "unauthorized", message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "forbidden", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "not_found", message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, "conflict", message);
  }
}
export class GoneError extends AppError {
  constructor(message = "Gone") {
    super(410, "gone", message);
  }
}

/** Single error handler — every route's failures become the same envelope. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      });
    }
    // Fastify built-in (e.g. malformed JSON) or unexpected.
    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) app.log.error(err);
    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "internal" : "error",
        message: statusCode >= 500 ? "Internal server error" : err.message,
      },
    });
  });
}
