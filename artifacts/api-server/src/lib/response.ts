import type { Response } from "express";
import type { AppErrorCode, AppError, ApiResponseMeta } from "@workspace/api-zod";

export interface ApiEnvelope<T> {
  data: T | null;
  error: AppError | null;
  meta?: ApiResponseMeta | null;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options?: { status?: number; meta?: ApiResponseMeta },
): void {
  const body: ApiEnvelope<T> = {
    data,
    error: null,
    ...(options?.meta !== undefined ? { meta: options.meta } : {}),
  };
  res.status(options?.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: AppErrorCode,
  message: string,
  options?: { details?: Record<string, unknown> | null; meta?: ApiResponseMeta },
): void {
  const error: AppError = {
    code,
    message,
    ...(options?.details !== undefined ? { details: options.details } : {}),
  };
  const body: ApiEnvelope<null> = {
    data: null,
    error,
    ...(options?.meta !== undefined ? { meta: options.meta } : {}),
  };
  res.status(status).json(body);
}
