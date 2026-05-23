import { Controller, Get, Param } from "@nestjs/common";
import { RequireRole } from "../access/require-role.decorator.js";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import {
  ExportStatusResponse,
  RenderJobsService,
} from "./render-jobs.service.js";

@Controller("exports")
export class ExportsController {
  constructor(private readonly renderJobsService: RenderJobsService) {}

  @Get(":id")
  @RequireRole("reader")
  getExport(@Param("id") id: string): Promise<ExportStatusResponse> {
    return this.renderJobsService.getExport(id);
  }
}
