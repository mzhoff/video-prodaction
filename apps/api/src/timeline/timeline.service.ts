import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  buildTimelineDraft,
  type TimelineCaseExample,
  type TimelineDraft,
  timelineCaseExamples,
  validateReverieSemanticProject,
} from "@repo/api";
import { v7 as uuidv7 } from "uuid";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { ReverieAdapter } from "./reverie.adapter.js";
// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { TimelineDraftsRepository } from "./timeline-drafts.repository.js";

export interface TimelineDraftPreviewResponse {
  timelineDraftId: string;
  semanticProjectId: string;
  timelineDraft: TimelineDraft;
  createdAt: string;
}

@Injectable()
export class TimelineService {
  constructor(
    private readonly reverieAdapter: ReverieAdapter,
    private readonly timelineDraftsRepository: TimelineDraftsRepository,
  ) {}

  async previewTimelineDraft(
    payload: unknown,
  ): Promise<TimelineDraftPreviewResponse> {
    const adaptedInput = this.reverieAdapter.adapt(payload);
    const validation = validateReverieSemanticProject(adaptedInput);

    if (!validation.ok) {
      throw new BadRequestException({
        message: "Semantic project validation failed",
        issues: validation.issues,
      });
    }

    const normalized = this.reverieAdapter.toReverieProject(validation.value);
    const draftId = uuidv7();
    const builtDraft = buildTimelineDraft(normalized);
    const timelineDraft: TimelineDraft = {
      ...builtDraft,
      draftId,
      sourceSemanticId: normalized.semanticId ?? builtDraft.sourceSemanticId,
    };

    await this.timelineDraftsRepository.create({
      externalId: draftId,
      sourceSemanticId: timelineDraft.sourceSemanticId,
      useCase: timelineDraft.useCase,
      semanticProject: normalized,
      draft: timelineDraft,
    });

    const stored =
      await this.timelineDraftsRepository.findByExternalId(draftId);
    if (!stored) {
      throw new NotFoundException({
        message: "Timeline draft not found right after creation",
        timelineDraftId: draftId,
      });
    }

    return {
      timelineDraftId: stored.externalId,
      semanticProjectId: timelineDraft.sourceSemanticId,
      timelineDraft: stored.draft,
      createdAt: stored.createdAt,
    };
  }

  getCaseExamples(): TimelineCaseExample[] {
    return timelineCaseExamples;
  }

  async getTimelineDraft(
    timelineDraftId: string,
  ): Promise<TimelineDraftPreviewResponse> {
    const stored =
      await this.timelineDraftsRepository.findByExternalId(timelineDraftId);
    if (!stored) {
      throw new NotFoundException({
        message: "Timeline draft not found",
        timelineDraftId,
      });
    }

    return {
      timelineDraftId: stored.externalId,
      semanticProjectId: stored.sourceSemanticId,
      timelineDraft: stored.draft,
      createdAt: stored.createdAt,
    };
  }
}
