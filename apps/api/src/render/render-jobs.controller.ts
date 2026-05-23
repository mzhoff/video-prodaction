import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { RenderJob } from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { RenderJobsService } from "./render-jobs.service.js";

@Controller("render-jobs")
export class RenderJobsController {
  constructor(private readonly renderJobsService: RenderJobsService) {}

  @Post()
  createRenderJob(@Body() payload: unknown): Promise<RenderJob> {
    return this.renderJobsService.createRenderJob(payload);
  }

  @Get(":id")
  getRenderJob(@Param("id") id: string): Promise<RenderJob> {
    return this.renderJobsService.getRenderJob(id);
  }
}
