import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

import type { RequestContext } from "../access/request-context.middleware.js";
import type { ErrorLogsRepository } from "./error-logs.repository.js";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorLogsRepository: ErrorLogsRepository) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const context = host.switchToHttp();
    const request = context.getRequest<
      Request & { requestContext?: RequestContext }
    >();
    const response = context.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeError(exception);
    const requestContext = request.requestContext;
    const requestId = requestContext?.requestId ?? "unknown-request";

    if (statusCode >= 500 || normalized.code) {
      try {
        await this.errorLogsRepository.add({
          requestId,
          role: requestContext?.role ?? "editor",
          method: request.method,
          path: request.originalUrl,
          statusCode,
          errorCode: normalized.code,
          message: normalized.message,
          details: normalized.details,
        });
      } catch (error) {
        console.error("[error-log-write-failed]", error);
      }
    }

    response.status(statusCode).json({
      statusCode,
      code: normalized.code ?? `HTTP_${statusCode}`,
      message: normalized.message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeError(exception: unknown): {
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return {
          message: response,
        };
      }

      if (typeof response === "object" && response !== null) {
        const candidate = response as {
          message?: string | string[];
          error?: string;
          code?: string;
          [key: string]: unknown;
        };

        const message = Array.isArray(candidate.message)
          ? candidate.message.join("; ")
          : typeof candidate.message === "string"
            ? candidate.message
            : exception.message;

        const code =
          typeof candidate.code === "string"
            ? candidate.code
            : typeof candidate.error === "string"
              ? candidate.error.toUpperCase().replaceAll(" ", "_")
              : undefined;

        return {
          code,
          message,
          details: response as Record<string, unknown>,
        };
      }
    }

    if (exception instanceof Error) {
      return {
        code: "UNEXPECTED_ERROR",
        message: exception.message,
        details: {
          name: exception.name,
          stack: exception.stack,
        },
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: "Unknown server error",
    };
  }
}
