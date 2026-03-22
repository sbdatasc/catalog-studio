import type { AppErrorCode } from "@workspace/api-zod";

/**
 * ServiceError is thrown by service functions to signal business-logic failures.
 * Route handlers catch it and call sendError() to produce the envelope error response.
 */
export class ServiceError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
