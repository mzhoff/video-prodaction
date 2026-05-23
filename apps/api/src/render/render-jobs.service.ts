import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  type RenderJob,
  type RenderRequest,
  type RenderResult,
  type VideoProject,
  validateRenderRequest,
} from "@repo/api";
import { v7 as uuidv7 } from "uuid";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { ProjectsRepository } from "../projects/projects.repository.js";
// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { RenderJobsRepository } from "./render-jobs.repository.js";

export interface ExportStatusResponse {
  exportId: string;
  renderJobId: string;
  status: "processing" | "ready" | "failed";
  downloadUrl?: string;
  artifacts?: RenderResult["artifacts"];
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class RenderJobsService implements OnModuleDestroy {
  private readonly activeTimers = new Map<string, NodeJS.Timeout[]>();

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly renderJobsRepository: RenderJobsRepository,
  ) {}

  onModuleDestroy(): void {
    this.activeTimers.forEach((timers) => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
    });

    this.activeTimers.clear();
  }

  async createRenderJob(payload: unknown): Promise<RenderJob> {
    const requestCandidate = this.normalizeIncomingRequest(payload);
    const requestValidation = validateRenderRequest(requestCandidate);

    if (!requestValidation.ok) {
      throw new BadRequestException({
        message: "RenderRequest validation failed",
        issues: requestValidation.issues,
      });
    }

    const request = requestValidation.value;
    const project = await this.projectsRepository.findByExternalId(
      request.projectId,
    );

    if (!project) {
      throw new NotFoundException({
        message: "Project not found",
        projectId: request.projectId,
      });
    }

    this.ensureVersionExists(project, request.projectVersionId);
    this.ensurePresetExists(
      project,
      request.projectVersionId,
      request.exportPresetId,
    );

    const jobId = uuidv7();

    await this.renderJobsRepository.createQueuedJob({
      jobId,
      request,
      maxAttempts: 3,
    });

    this.scheduleLifecycle(jobId, request);

    const job = await this.renderJobsRepository.findByExternalId(jobId);
    if (!job) {
      throw new NotFoundException({
        message: "Render job not found right after creation",
        jobId,
      });
    }

    return job;
  }

  async getRenderJob(jobId: string): Promise<RenderJob> {
    const job = await this.renderJobsRepository.findByExternalId(jobId);
    if (!job) {
      throw new NotFoundException({
        message: "Render job not found",
        jobId,
      });
    }

    return job;
  }

  async getExport(exportId: string): Promise<ExportStatusResponse> {
    const job = await this.getRenderJob(exportId);

    if (job.status === "done" && job.result?.exportUrl) {
      return {
        exportId,
        renderJobId: job.id,
        status: "ready",
        downloadUrl: job.result.exportUrl,
        artifacts: job.result.artifacts,
      };
    }

    if (job.status === "failed") {
      return {
        exportId,
        renderJobId: job.id,
        status: "failed",
        errorCode: job.result?.errorCode ?? "RENDER_FAILED",
        errorMessage: job.result?.errorMessage ?? "Render failed",
        artifacts: job.result?.artifacts,
      };
    }

    return {
      exportId,
      renderJobId: job.id,
      status: "processing",
    };
  }

  private normalizeIncomingRequest(payload: unknown): unknown {
    if (!this.isObject(payload)) {
      return payload;
    }

    return {
      requestId:
        typeof payload.requestId === "string" &&
        payload.requestId.trim().length > 0
          ? payload.requestId
          : uuidv7(),
      requestedAt:
        typeof payload.requestedAt === "string" &&
        payload.requestedAt.length > 0
          ? payload.requestedAt
          : new Date().toISOString(),
      priority:
        payload.priority === "low" || payload.priority === "high"
          ? payload.priority
          : "normal",
      ...payload,
    };
  }

  private ensureVersionExists(project: VideoProject, versionId: string): void {
    const hasVersion = project.versions.some(
      (version) => version.id === versionId,
    );

    if (!hasVersion) {
      throw new BadRequestException({
        message: "Project version not found",
        projectId: project.id,
        projectVersionId: versionId,
      });
    }
  }

  private ensurePresetExists(
    project: VideoProject,
    versionId: string,
    exportPresetId: string,
  ): void {
    const version = project.versions.find((item) => item.id === versionId);
    const hasPreset = version?.exportPresets.some(
      (preset) => preset.id === exportPresetId,
    );

    if (!hasPreset) {
      throw new BadRequestException({
        message: "Export preset not found in project version",
        projectId: project.id,
        projectVersionId: versionId,
        exportPresetId,
      });
    }
  }

  private scheduleLifecycle(jobId: string, request: RenderRequest): void {
    const runningTimer = setTimeout(async () => {
      try {
        await this.renderJobsRepository.markRunning(jobId);
      } catch {
        this.clearJobTimers(jobId);
      }
    }, 500);

    const finalTimer = setTimeout(async () => {
      try {
        const shouldFail = request.exportPresetId
          .toLowerCase()
          .includes("fail");
        if (shouldFail) {
          const failedResult: RenderResult = {
            jobId,
            status: "failed",
            durationMs: 1200,
            artifacts: [
              {
                kind: "log",
                url: `https://cdn.video-action.local/logs/${jobId}.log`,
              },
            ],
            errorCode: "RENDER_PIPELINE_ERROR",
            errorMessage:
              "Prototype render failed. Check source assets and preset settings.",
          };

          await this.renderJobsRepository.markFailed(jobId, failedResult);
        } else {
          const doneResult: RenderResult = {
            jobId,
            status: "done",
            durationMs: 2100,
            exportUrl: `https://cdn.video-action.local/exports/${jobId}.mp4`,
            artifacts: [
              {
                kind: "video",
                url: `https://cdn.video-action.local/exports/${jobId}.mp4`,
              },
              {
                kind: "log",
                url: `https://cdn.video-action.local/logs/${jobId}.log`,
              },
              {
                kind: "timeline",
                url: `https://cdn.video-action.local/timelines/${jobId}.json`,
              },
            ],
          };

          await this.renderJobsRepository.markDone(jobId, doneResult);
        }
      } finally {
        this.clearJobTimers(jobId);
      }
    }, 2000);

    this.activeTimers.set(jobId, [runningTimer, finalTimer]);
  }

  private clearJobTimers(jobId: string): void {
    const timers = this.activeTimers.get(jobId);
    if (!timers) {
      return;
    }

    timers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.activeTimers.delete(jobId);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
