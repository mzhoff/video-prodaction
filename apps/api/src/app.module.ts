import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";

import { RequestContextMiddleware } from "./access/request-context.middleware.js";
import { RolesGuard } from "./access/roles.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { ErrorLogsRepository } from "./ops/error-logs.repository.js";
import { GlobalExceptionFilter } from "./ops/global-exception.filter.js";
import { OpsController } from "./ops/ops.controller.js";
import { PilotWorkflowController } from "./pilot/pilot-workflow.controller.js";
import { PilotWorkflowService } from "./pilot/pilot-workflow.service.js";
import { ProjectsController } from "./projects/projects.controller.js";
import { ProjectsRepository } from "./projects/projects.repository.js";
import { ProjectsService } from "./projects/projects.service.js";
import { ExportsController } from "./render/exports.controller.js";
import { RenderJobsController } from "./render/render-jobs.controller.js";
import { RenderJobsRepository } from "./render/render-jobs.repository.js";
import { RenderJobsService } from "./render/render-jobs.service.js";
import { RenderPipelineAdapter } from "./render/render-pipeline.adapter.js";
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
    OpsController,
    PilotWorkflowController,
  ],
  providers: [
    ErrorLogsRepository,
    PilotWorkflowService,
    ProjectsRepository,
    ProjectsService,
    RenderJobsRepository,
    RenderPipelineAdapter,
    RenderJobsService,
    ReverieAdapter,
    TimelineDraftsRepository,
    TimelineService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: "*",
      method: RequestMethod.ALL,
    });
  }
}
