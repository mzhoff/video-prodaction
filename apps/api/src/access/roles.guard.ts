import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { REQUIRED_ROLE_KEY } from "./require-role.decorator.js";
import type { UserRole } from "./roles.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<UserRole | undefined>(
      REQUIRED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest() as {
      requestContext?: {
        role?: UserRole;
      };
    };
    const actualRole = request.requestContext?.role ?? "editor";

    if (requiredRole === "reader") {
      return actualRole === "editor" || actualRole === "reader";
    }

    return actualRole === "editor";
  }
}
