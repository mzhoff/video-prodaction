import { Injectable } from "@nestjs/common";
import type {
  ReverieSemanticProject,
  SemanticUseCase,
  TimelineDraft,
} from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { PostgresService } from "../database/postgres.service.js";

interface TimelineDraftRow {
  external_id: string;
  source_semantic_id: string;
  use_case: SemanticUseCase;
  semantic_payload: ReverieSemanticProject;
  draft_payload: TimelineDraft;
  created_at: string;
  updated_at: string;
}

export interface StoredTimelineDraft {
  externalId: string;
  sourceSemanticId: string;
  useCase: SemanticUseCase;
  semanticProject: ReverieSemanticProject;
  draft: TimelineDraft;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TimelineDraftsRepository {
  constructor(private readonly postgres: PostgresService) {}

  async create(params: {
    externalId: string;
    sourceSemanticId: string;
    useCase: SemanticUseCase;
    semanticProject: ReverieSemanticProject;
    draft: TimelineDraft;
  }): Promise<void> {
    await this.postgres.query(
      `
      INSERT INTO timeline_drafts (
        external_id,
        source_semantic_id,
        use_case,
        semantic_payload,
        draft_payload,
        updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())
      `,
      [
        params.externalId,
        params.sourceSemanticId,
        params.useCase,
        params.semanticProject,
        params.draft,
      ],
    );
  }

  async findByExternalId(
    externalId: string,
  ): Promise<StoredTimelineDraft | null> {
    const result = await this.postgres.query<TimelineDraftRow>(
      `
      SELECT
        external_id,
        source_semantic_id,
        use_case,
        semantic_payload,
        draft_payload,
        created_at,
        updated_at
      FROM timeline_drafts
      WHERE external_id = $1
      LIMIT 1
      `,
      [externalId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const [firstRow] = result.rows;
    if (!firstRow) {
      return null;
    }

    return {
      externalId: firstRow.external_id,
      sourceSemanticId: firstRow.source_semantic_id,
      useCase: firstRow.use_case,
      semanticProject: firstRow.semantic_payload,
      draft: firstRow.draft_payload,
      createdAt: firstRow.created_at,
      updatedAt: firstRow.updated_at,
    };
  }
}
