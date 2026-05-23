import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { v7 as uuidv7 } from "uuid";

import { normalizeUserRole, type UserRole } from "./roles.js";

export interface RequestContext {
  requestId: string;
  role: UserRole;
  startedAtMs: number;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
        ? requestIdHeader
        : uuidv7();

    const role = normalizeUserRole(request.headers["x-user-role"]);

    const context: RequestContext = {
      requestId,
      role,
      startedAtMs: Date.now(),
    };

    const mutableRequest = request as Request & {
      requestContext?: RequestContext;
    };
    mutableRequest.requestContext = context;

    next();
  }
}
