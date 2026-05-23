import { SetMetadata } from "@nestjs/common";

import type { UserRole } from "./roles.js";

export const REQUIRED_ROLE_KEY = "requiredRole";

export const RequireRole = (role: UserRole) =>
  SetMetadata(REQUIRED_ROLE_KEY, role);
