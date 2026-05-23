import { Injectable } from "@nestjs/common";
import type { VideoProject } from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { PostgresService } from "../database/postgres.service.js";

interface ProjectRow {
  external_id: string;
  payload: VideoProject;
}

@Injectable()
export class ProjectsRepository {
  constructor(private readonly postgres: PostgresService) {}

  async create(project: VideoProject): Promise<void> {
    await this.postgres.query(
      `
      INSERT INTO projects (external_id, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      `,
      [project.id, project],
    );
  }

  async findByExternalId(projectId: string): Promise<VideoProject | null> {
    const result = await this.postgres.query<ProjectRow>(
      `
      SELECT external_id, payload
      FROM projects
      WHERE external_id = $1
      LIMIT 1
      `,
      [projectId],
    );

    return result.rowCount === 0 ? null : (result.rows[0]?.payload ?? null);
  }

  async update(project: VideoProject): Promise<void> {
    await this.postgres.query(
      `
      UPDATE projects
      SET payload = $2::jsonb,
          updated_at = NOW()
      WHERE external_id = $1
      `,
      [project.id, project],
    );
  }
}
