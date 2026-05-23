import { Injectable } from "@nestjs/common";
import type { UserRole } from "../access/roles.js";
import type { PostgresService } from "../database/postgres.service.js";

interface ErrorLogRow {
  id: string;
  request_id: string;
  role: UserRole;
  method: string;
  path: string;
  status_code: number;
  error_code: string | null;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface SummaryRow {
  status_code: number;
  total: string;
}

export interface ErrorLogItem {
  id: string;
  requestId: string;
  role: UserRole;
  method: string;
  path: string;
  statusCode: number;
  errorCode?: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class ErrorLogsRepository {
  constructor(private readonly postgres: PostgresService) {}

  async add(item: {
    requestId: string;
    role: UserRole;
    method: string;
    path: string;
    statusCode: number;
    errorCode?: string;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.postgres.query(
      `
      INSERT INTO system_error_logs (
        request_id,
        role,
        method,
        path,
        status_code,
        error_code,
        message,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        item.requestId,
        item.role,
        item.method,
        item.path,
        item.statusCode,
        item.errorCode ?? null,
        item.message,
        item.details ?? null,
      ],
    );
  }

  async listRecent(limit: number): Promise<ErrorLogItem[]> {
    const result = await this.postgres.query<ErrorLogRow>(
      `
      SELECT
        id,
        request_id,
        role,
        method,
        path,
        status_code,
        error_code,
        message,
        details,
        created_at
      FROM system_error_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      role: row.role,
      method: row.method,
      path: row.path,
      statusCode: row.status_code,
      errorCode: row.error_code ?? undefined,
      message: row.message,
      details: row.details ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async getSummary(): Promise<{
    totalLast24h: number;
    byStatusCode: Array<{ statusCode: number; total: number }>;
  }> {
    const totalsResult = await this.postgres.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM system_error_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
    );

    const groupedResult = await this.postgres.query<SummaryRow>(
      `
      SELECT status_code, COUNT(*)::text AS total
      FROM system_error_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY status_code
      ORDER BY status_code ASC
      `,
    );

    const totalLast24h = Number(totalsResult.rows[0]?.total ?? "0");

    return {
      totalLast24h,
      byStatusCode: groupedResult.rows.map((row) => ({
        statusCode: row.status_code,
        total: Number(row.total),
      })),
    };
  }
}
