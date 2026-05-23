import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import type { VideoProject, VideoProjectVersion } from "@repo/api";

import { RequireRole } from "../access/require-role.decorator.js";
// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { ProjectsService } from "./projects.service.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireRole("editor")
  createProject(@Body() payload: unknown): Promise<VideoProject> {
    return this.projectsService.createProject(payload);
  }

  @Get(":id")
  @RequireRole("reader")
  getProject(@Param("id") id: string): Promise<VideoProject> {
    return this.projectsService.getProject(id);
  }

  @Get(":id/versions")
  @RequireRole("reader")
  getVersions(@Param("id") id: string): Promise<VideoProjectVersion[]> {
    return this.projectsService.listVersions(id);
  }

  @Get(":id/versions/:versionId")
  @RequireRole("reader")
  getVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ): Promise<VideoProjectVersion> {
    return this.projectsService.getVersion(id, versionId);
  }

  @Post(":id/versions")
  @RequireRole("editor")
  createVersion(
    @Param("id") id: string,
    @Body() payload: unknown,
  ): Promise<VideoProjectVersion> {
    return this.projectsService.createVersion(id, payload);
  }

  @Put(":id/current-version")
  @RequireRole("editor")
  switchCurrentVersion(
    @Param("id") id: string,
    @Body() payload: unknown,
  ): Promise<VideoProject> {
    const versionId =
      typeof payload === "object" && payload !== null
        ? (payload as { versionId?: unknown }).versionId
        : undefined;

    if (typeof versionId !== "string" || versionId.length === 0) {
      throw new BadRequestException({
        message: "versionId is required",
      });
    }

    return this.projectsService.setCurrentVersion(id, versionId);
  }

  @Post(":id/versions/:versionId/export-presets")
  @RequireRole("editor")
  addExportPreset(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Body() payload: unknown,
  ): Promise<VideoProjectVersion> {
    return this.projectsService.addExportPreset(id, versionId, payload);
  }
}
