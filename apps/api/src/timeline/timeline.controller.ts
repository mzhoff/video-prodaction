import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { TimelineCaseExample } from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import {
  type TimelineDraftPreviewResponse,
  TimelineService,
} from "./timeline.service.js";

@Controller("timeline-drafts")
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Post()
  previewDraft(
    @Body() payload: unknown,
  ): Promise<TimelineDraftPreviewResponse> {
    return this.timelineService.previewTimelineDraft(payload);
  }

  @Get("examples")
  getExamples(): TimelineCaseExample[] {
    return this.timelineService.getCaseExamples();
  }

  @Get(":id")
  getTimelineDraft(
    @Param("id") id: string,
  ): Promise<TimelineDraftPreviewResponse> {
    return this.timelineService.getTimelineDraft(id);
  }
}
