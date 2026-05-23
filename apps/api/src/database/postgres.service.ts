import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/video_prodaction",
  });

  async onModuleInit(): Promise<void> {
    await this.pool.query("SELECT 1");
    await this.ensureSchema();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  private async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id BIGSERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS render_jobs (
        id BIGSERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        project_external_id TEXT NOT NULL,
        project_version_id TEXT NOT NULL,
        export_preset_id TEXT NOT NULL,
        request_payload JSONB NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        result_payload JSONB,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        CONSTRAINT render_jobs_status_check CHECK (
          status IN ('queued', 'running', 'done', 'failed')
        ),
        CONSTRAINT render_jobs_project_fk FOREIGN KEY (project_external_id)
          REFERENCES projects(external_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS render_jobs_project_external_id_idx
        ON render_jobs(project_external_id);
    `);
  }
}
