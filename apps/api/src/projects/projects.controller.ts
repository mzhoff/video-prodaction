import { Body, Controller, Post } from "@nestjs/common";
import type { VideoProject } from "@repo/api";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { ProjectsService } from "./projects.service.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(@Body() payload: unknown): Promise<VideoProject> {
    return this.projectsService.createProject(payload);
  }
}
