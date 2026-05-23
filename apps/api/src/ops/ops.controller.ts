import { Controller, Get, Query } from "@nestjs/common";

import { RequireRole } from "../access/require-role.decorator.js";
import type {
  ErrorLogItem,
  ErrorLogsRepository,
} from "./error-logs.repository.js";

@Controller("ops/errors")
export class OpsController {
  constructor(private readonly errorLogsRepository: ErrorLogsRepository) {}

  @Get()
  @RequireRole("reader")
  getRecentErrors(@Query("limit") limit?: string): Promise<ErrorLogItem[]> {
    const parsedLimit = Number(limit ?? "30");
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(200, Math.floor(parsedLimit)))
      : 30;

    return this.errorLogsRepository.listRecent(safeLimit);
  }

  @Get("summary")
  @RequireRole("reader")
  getSummary(): Promise<{
    totalLast24h: number;
    byStatusCode: Array<{ statusCode: number; total: number }>;
  }> {
    return this.errorLogsRepository.getSummary();
  }
}
