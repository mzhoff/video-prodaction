import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { VideoProject } from "@repo/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenderJobsService } from "./render-jobs.service.js";

const makeProject = (): VideoProject => ({
  id: "01973a3f-2e12-7000-a2df-25c18b5e3b5f",
  name: "Test project",
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:00:00.000Z",
  currentVersionId: "version-1",
  versions: [
    {
      id: "version-1",
      versionNumber: 1,
      createdAt: "2026-05-23T00:00:00.000Z",
      createdBy: "pm@local",
      scenes: [],
      tracks: [],
      assets: [],
      effects: [],
      exportPresets: [
        {
          id: "preset-1",
          name: "Preset",
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          bitrateKbps: 8000,
          audioCodec: "aac",
        },
      ],
    },
  ],
});

describe("RenderJobsService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws NotFound when project does not exist", async () => {
    const projectsRepository = {
      findByExternalId: vi.fn().mockResolvedValue(null),
    };

    const renderJobsRepository = {
      createQueuedJob: vi.fn(),
      findByExternalId: vi.fn(),
      markRunning: vi.fn(),
      markDone: vi.fn(),
      markFailed: vi.fn(),
    };

    const service = new RenderJobsService(
      projectsRepository as never,
      renderJobsRepository as never,
    );

    await expect(
      service.createRenderJob({
        projectId: "missing",
        projectVersionId: "version-1",
        exportPresetId: "preset-1",
        requestedBy: "pm@local",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates queued job for valid request", async () => {
    vi.useFakeTimers();

    const project = makeProject();
    const queuedJob = {
      id: "01973a41-00fd-7ce2-a765-cf7da6f989ab",
      projectId: project.id,
      projectVersionId: "version-1",
      request: {
        requestId: "01973a40-917e-7cf2-af35-b15bb7f28f8a",
        projectId: project.id,
        projectVersionId: "version-1",
        exportPresetId: "preset-1",
        requestedBy: "pm@local",
        requestedAt: "2026-05-23T00:00:00.000Z",
        priority: "normal" as const,
      },
      status: "queued" as const,
      attempts: 0,
      maxAttempts: 3,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    };

    const projectsRepository = {
      findByExternalId: vi.fn().mockResolvedValue(project),
    };

    const renderJobsRepository = {
      createQueuedJob: vi.fn().mockResolvedValue(undefined),
      findByExternalId: vi.fn().mockResolvedValue(queuedJob),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markDone: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    const service = new RenderJobsService(
      projectsRepository as never,
      renderJobsRepository as never,
    );

    const result = await service.createRenderJob({
      projectId: project.id,
      projectVersionId: "version-1",
      exportPresetId: "preset-1",
      requestedBy: "pm@local",
    });

    expect(result.status).toBe("queued");
    expect(renderJobsRepository.createQueuedJob).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });

  it("throws validation error for wrong request payload", async () => {
    const projectsRepository = {
      findByExternalId: vi.fn(),
    };

    const renderJobsRepository = {
      createQueuedJob: vi.fn(),
      findByExternalId: vi.fn(),
      markRunning: vi.fn(),
      markDone: vi.fn(),
      markFailed: vi.fn(),
    };

    const service = new RenderJobsService(
      projectsRepository as never,
      renderJobsRepository as never,
    );

    await expect(service.createRenderJob({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
