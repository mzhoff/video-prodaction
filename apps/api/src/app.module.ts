import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { ProjectsController } from "./projects/projects.controller.js";
import { ProjectsRepository } from "./projects/projects.repository.js";
import { ProjectsService } from "./projects/projects.service.js";
import { ExportsController } from "./render/exports.controller.js";
import { RenderJobsController } from "./render/render-jobs.controller.js";
import { RenderJobsRepository } from "./render/render-jobs.repository.js";
import { RenderJobsService } from "./render/render-jobs.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController, RenderJobsController, ExportsController],
  providers: [
    ProjectsRepository,
    ProjectsService,
    RenderJobsRepository,
    RenderJobsService,
  ],
})
export class AppModule {}
