import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { ProjectsController } from "./projects/projects.controller.js";
import { ProjectsRepository } from "./projects/projects.repository.js";
import { ProjectsService } from "./projects/projects.service.js";
import { ExportsController } from "./render/exports.controller.js";
import { RenderJobsController } from "./render/render-jobs.controller.js";
import { RenderJobsRepository } from "./render/render-jobs.repository.js";
import { RenderJobsService } from "./render/render-jobs.service.js";
import { ReverieAdapter } from "./timeline/reverie.adapter.js";
import { TimelineController } from "./timeline/timeline.controller.js";
import { TimelineService } from "./timeline/timeline.service.js";
import { TimelineDraftsRepository } from "./timeline/timeline-drafts.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [
    ProjectsController,
    RenderJobsController,
    ExportsController,
    TimelineController,
  ],
  providers: [
    ProjectsRepository,
    ProjectsService,
    RenderJobsRepository,
    RenderJobsService,
    ReverieAdapter,
    TimelineDraftsRepository,
    TimelineService,
  ],
})
export class AppModule {}
