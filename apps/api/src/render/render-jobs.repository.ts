import { Injectable } from "@nestjs/common";
import type { RenderJob, RenderRequest, RenderResult } from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { PostgresService } from "../database/postgres.service.js";

interface RenderJobRow {
  external_id: string;
  project_external_id: string;
  project_version_id: string;
  request_payload: RenderRequest;
  export_preset_id: string;
  status: RenderJob["status"];
  attempts: number;
  max_attempts: number;
  result_payload: RenderResult | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

@Injectable()
export class RenderJobsRepository {
  constructor(private readonly postgres: PostgresService) {}

  async createQueuedJob(params: {
    jobId: string;
    request: RenderRequest;
    maxAttempts: number;
  }): Promise<void> {
    await this.postgres.query(
      `
      INSERT INTO render_jobs (
        external_id,
        project_external_id,
        project_version_id,
        export_preset_id,
        request_payload,
        status,
        attempts,
        max_attempts,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, 'queued', 0, $6, NOW())
      `,
      [
        params.jobId,
        params.request.projectId,
        params.request.projectVersionId,
        params.request.exportPresetId,
        params.request,
        params.maxAttempts,
      ],
    );
  }

  async findByExternalId(jobId: string): Promise<RenderJob | null> {
    const result = await this.postgres.query<RenderJobRow>(
      `
      SELECT
        external_id,
        project_external_id,
        project_version_id,
        request_payload,
        export_preset_id,
        status,
        attempts,
        max_attempts,
        result_payload,
        error_code,
        error_message,
        created_at,
        updated_at,
        started_at,
        finished_at
      FROM render_jobs
      WHERE external_id = $1
      LIMIT 1
      `,
      [jobId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const [firstRow] = result.rows;
    if (!firstRow) {
      return null;
    }

    return this.mapRowToRenderJob(firstRow);
  }

  async markRunning(jobId: string): Promise<void> {
    await this.postgres.query(
      `
      UPDATE render_jobs
      SET status = 'running',
          started_at = COALESCE(started_at, NOW()),
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE external_id = $1
        AND status = 'queued'
      `,
      [jobId],
    );
  }

  async markDone(jobId: string, result: RenderResult): Promise<void> {
    await this.postgres.query(
      `
      UPDATE render_jobs
      SET status = 'done',
          result_payload = $2::jsonb,
          error_code = NULL,
          error_message = NULL,
          finished_at = NOW(),
          updated_at = NOW()
      WHERE external_id = $1
      `,
      [jobId, result],
    );
  }

  async markFailed(jobId: string, result: RenderResult): Promise<void> {
    await this.postgres.query(
      `
      UPDATE render_jobs
      SET status = 'failed',
          result_payload = $2::jsonb,
          error_code = $3,
          error_message = $4,
          finished_at = NOW(),
          updated_at = NOW()
      WHERE external_id = $1
      `,
      [jobId, result, result.errorCode ?? null, result.errorMessage ?? null],
    );
  }

  private mapRowToRenderJob(row: RenderJobRow): RenderJob {
    return {
      id: row.external_id,
      projectId: row.project_external_id,
      projectVersionId: row.project_version_id,
      request: row.request_payload,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      result: row.result_payload ?? undefined,
    };
  }
}
