import { describe, expect, it, vi } from "vitest";

import { PilotWorkflowService } from "./pilot-workflow.service.js";

const createService = () => {
  const projectsService = {
    createProject: vi.fn(async (payload: unknown) => payload),
  };

  const renderJobsService = {
    createRenderJob: vi.fn(
      async (payload: { projectId: string; projectVersionId: string }) => ({
        id: `job-${payload.projectId}`,
        projectId: payload.projectId,
        projectVersionId: payload.projectVersionId,
        request: {
          requestId: "request-1",
          projectId: payload.projectId,
          projectVersionId: payload.projectVersionId,
          exportPresetId: "preset-social-1080",
          requestedBy: "pm@pilot.local",
          requestedAt: new Date().toISOString(),
          priority: "normal",
        },
        status: "done",
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        result: {
          jobId: `job-${payload.projectId}`,
          status: "done",
          durationMs: 1000,
          exportUrl: "/artifacts/renders/project/version/job.mp4",
          artifacts: [
            {
              kind: "video",
              url: "/artifacts/renders/project/version/job.mp4",
            },
          ],
        },
      }),
    ),
    getRenderJob: vi.fn(async () => ({
      id: "job-1",
      projectId: "project-1",
      projectVersionId: "version-1",
      request: {
        requestId: "request-1",
        projectId: "project-1",
        projectVersionId: "version-1",
        exportPresetId: "preset-social-1080",
        requestedBy: "pm@pilot.local",
        requestedAt: new Date().toISOString(),
        priority: "normal",
      },
      status: "done",
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: {
        jobId: "job-1",
        status: "done",
        durationMs: 1000,
        exportUrl: "/artifacts/renders/project/version/job.mp4",
        artifacts: [
          {
            kind: "video",
            url: "/artifacts/renders/project/version/job.mp4",
          },
        ],
      },
    })),
    getExport: vi.fn(async () => ({
      exportId: "job-1",
      renderJobId: "job-1",
      status: "ready",
      downloadUrl: "/artifacts/renders/project/version/job.mp4",
    })),
  };

  return {
    projectsService,
    renderJobsService,
    service: new PilotWorkflowService(
      projectsService as never,
      renderJobsService as never,
    ),
  };
};

describe("PilotWorkflowService", () => {
  it("returns three supported scenarios", () => {
    const { service } = createService();
    expect(service.getSupportedScenarios().map((item) => item.id)).toEqual([
      "hook",
      "one-minute-script",
      "social-post",
    ]);
  });

  it("runs pilot workflow for 3 scenarios", async () => {
    const { service, projectsService, renderJobsService } = createService();

    const scenarios = ["hook", "one-minute-script", "social-post"] as const;

    for (const scenario of scenarios) {
      const result = await service.run({
        idea: `Idea for ${scenario}`,
        useCase: scenario,
        requestedBy: "pm@pilot.local",
      });

      expect(result.scenario).toBe(scenario);
      expect(result.project.versions.length).toBe(1);
      expect(result.project.versions[0]?.exportPresets.length).toBeGreaterThan(
        0,
      );
      expect(result.exportStatus?.status).toBe("ready");
    }

    expect(projectsService.createProject).toHaveBeenCalledTimes(3);
    expect(renderJobsService.createRenderJob).toHaveBeenCalledTimes(3);
  });
});
