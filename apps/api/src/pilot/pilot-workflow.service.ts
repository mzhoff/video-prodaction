import { BadRequestException, Injectable } from "@nestjs/common";
import {
  buildTimelineDraft,
  type RenderJob,
  type RenderRequest,
  type SemanticUseCase,
  type VideoProject,
  validateReverieSemanticProject,
  validateVideoProject,
} from "@repo/api";
import { v7 as uuidv7 } from "uuid";

import type { ProjectsService } from "../projects/projects.service.js";
import type {
  ExportStatusResponse,
  RenderJobsService,
} from "../render/render-jobs.service.js";

export interface PilotWorkflowRequest {
  idea: string;
  useCase: SemanticUseCase;
  requestedBy: string;
  waitForResult?: boolean;
}

export interface PilotWorkflowResponse {
  scenario: SemanticUseCase;
  project: VideoProject;
  renderJob: RenderJob;
  exportStatus?: ExportStatusResponse;
}

@Injectable()
export class PilotWorkflowService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly renderJobsService: RenderJobsService,
  ) {}

  getSupportedScenarios(): Array<{
    id: SemanticUseCase;
    title: string;
  }> {
    return [
      { id: "hook", title: "Hook: short attention opener" },
      { id: "one-minute-script", title: "1 minute script" },
      { id: "social-post", title: "Social post" },
    ];
  }

  async run(payload: unknown): Promise<PilotWorkflowResponse> {
    const input = this.normalizePayload(payload);

    const semanticCandidate = {
      semanticId: uuidv7(),
      useCase: input.useCase,
      title: `Pilot semantic: ${input.useCase}`,
      targetDurationMs: this.defaultDuration(input.useCase),
      scenes: this.buildScenesFromIdea(input.idea, input.useCase),
      globalInstructions: "Keep structure production-ready for stage v1.0",
    };

    const semanticValidation =
      validateReverieSemanticProject(semanticCandidate);
    if (!semanticValidation.ok) {
      throw new BadRequestException({
        message: "Semantic project validation failed",
        issues: semanticValidation.issues,
      });
    }

    const timeline = buildTimelineDraft(semanticValidation.value);
    const project = this.convertTimelineToProject({
      timeline,
      name: `Pilot ${input.useCase} ${new Date().toISOString()}`,
      createdBy: input.requestedBy,
    });

    const projectValidation = validateVideoProject(project);
    if (!projectValidation.ok) {
      throw new BadRequestException({
        message: "Video project validation failed for pilot workflow",
        issues: projectValidation.issues,
      });
    }

    const persistedProject = await this.projectsService.createProject(project);

    const renderRequest: RenderRequest = {
      requestId: uuidv7(),
      projectId: persistedProject.id,
      projectVersionId: persistedProject.currentVersionId,
      exportPresetId:
        persistedProject.versions[0]?.exportPresets[0]?.id ??
        "preset-social-1080",
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString(),
      priority: "normal",
    };

    const renderJob =
      await this.renderJobsService.createRenderJob(renderRequest);

    if (!input.waitForResult) {
      return {
        scenario: input.useCase,
        project: persistedProject,
        renderJob,
      };
    }

    const finishedJob = await this.waitForTerminalStatus(renderJob.id, 90_000);
    const exportStatus = await this.renderJobsService.getExport(finishedJob.id);

    return {
      scenario: input.useCase,
      project: persistedProject,
      renderJob: finishedJob,
      exportStatus,
    };
  }

  private async waitForTerminalStatus(
    jobId: string,
    timeoutMs: number,
  ): Promise<RenderJob> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const job = await this.renderJobsService.getRenderJob(jobId);
      if (job.status === "done" || job.status === "failed") {
        return job;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 700);
      });
    }

    throw new BadRequestException({
      message: "Render timeout in pilot workflow",
      jobId,
    });
  }

  private defaultDuration(useCase: SemanticUseCase): number {
    if (useCase === "hook") {
      return 8_000;
    }

    if (useCase === "one-minute-script") {
      return 60_000;
    }

    return 24_000;
  }

  private buildScenesFromIdea(
    idea: string,
    useCase: SemanticUseCase,
  ): Array<{
    id: string;
    title: string;
    summary: string;
    text: string;
    targetDurationMs: number;
    mode: "ai-generated" | "teleprompter" | "user-upload";
    tags: string[];
  }> {
    const compactIdea = idea.trim();

    if (useCase === "hook") {
      return [
        {
          id: "scene-hook-1",
          title: "Pain",
          summary: "Define urgent pain",
          text: `Pain: ${compactIdea}`,
          targetDurationMs: 5000,
          mode: "ai-generated",
          tags: ["hook", "pain"],
        },
        {
          id: "scene-hook-2",
          title: "Promise",
          summary: "Show fast value",
          text: `Promise: fast transformation for ${compactIdea}`,
          targetDurationMs: 3000,
          mode: "ai-generated",
          tags: ["hook", "promise"],
        },
      ];
    }

    if (useCase === "one-minute-script") {
      return [
        {
          id: "scene-script-1",
          title: "Hook",
          summary: "Opening statement",
          text: `Hook: ${compactIdea}`,
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "hook"],
        },
        {
          id: "scene-script-2",
          title: "Context",
          summary: "Why it matters",
          text: `Context: ${compactIdea}`,
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "context"],
        },
        {
          id: "scene-script-3",
          title: "Solution",
          summary: "How to execute",
          text: "Solution: semantic -> timeline -> render",
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "solution"],
        },
        {
          id: "scene-script-4",
          title: "Proof",
          summary: "Expected outcome",
          text: "Proof: stable turnaround for pilot client",
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "proof"],
        },
        {
          id: "scene-script-5",
          title: "Flow",
          summary: "Operational steps",
          text: "Flow: create project, review, launch render",
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "flow"],
        },
        {
          id: "scene-script-6",
          title: "CTA",
          summary: "Call to action",
          text: "CTA: launch pilot scenario",
          targetDurationMs: 10000,
          mode: "teleprompter",
          tags: ["script", "cta"],
        },
      ];
    }

    return [
      {
        id: "scene-social-1",
        title: "Intro",
        summary: "Set context",
        text: `Intro: ${compactIdea}`,
        targetDurationMs: 4000,
        mode: "ai-generated",
        tags: ["social", "intro"],
      },
      {
        id: "scene-social-2",
        title: "Demo",
        summary: "Demonstrate use",
        text: "Demo: semantic planning and montage",
        targetDurationMs: 12000,
        mode: "ai-generated",
        tags: ["social", "demo"],
      },
      {
        id: "scene-social-3",
        title: "CTA",
        summary: "Prompt reaction",
        text: "CTA: comment and request timeline",
        targetDurationMs: 8000,
        mode: "ai-generated",
        tags: ["social", "cta"],
      },
    ];
  }

  private convertTimelineToProject(params: {
    timeline: ReturnType<typeof buildTimelineDraft>;
    name: string;
    createdBy: string;
  }): VideoProject {
    const projectId = uuidv7();
    const versionId = uuidv7();
    const now = new Date().toISOString();

    const assets: VideoProject["versions"][number]["assets"] = [];
    const effects: VideoProject["versions"][number]["effects"] = [];
    const videoClips: VideoProject["versions"][number]["tracks"][number]["clips"] =
      [];
    const audioClips: VideoProject["versions"][number]["tracks"][number]["clips"] =
      [];
    const subtitleClips: VideoProject["versions"][number]["tracks"][number]["clips"] =
      [];

    const scenes = params.timeline.scenes.map((scene, index) => {
      const videoAssetId = uuidv7();
      const audioAssetId = uuidv7();
      const subtitleAssetId = uuidv7();
      const transitionEffectId = uuidv7();

      assets.push(
        {
          id: videoAssetId,
          kind: "video",
          sourceUrl: `https://cdn.video-action.local/assets/${projectId}/scene-${index + 1}.mp4`,
          durationMs: scene.durationMs,
        },
        {
          id: audioAssetId,
          kind: "audio",
          sourceUrl: `https://cdn.video-action.local/assets/${projectId}/voice-${index + 1}.wav`,
          durationMs: scene.durationMs,
        },
        {
          id: subtitleAssetId,
          kind: "text",
          sourceUrl: `https://cdn.video-action.local/assets/${projectId}/subtitle-${index + 1}.json`,
          metadata: {
            text: scene.prompt,
          },
        },
      );

      effects.push({
        id: transitionEffectId,
        kind: "transition",
        name: "Cut",
        params: {
          durationMs: 120,
        },
      });

      videoClips.push({
        id: uuidv7(),
        sceneId: scene.id,
        assetId: videoAssetId,
        effectIds: [transitionEffectId],
        startMs: scene.startMs,
        durationMs: scene.durationMs,
      });
      audioClips.push({
        id: uuidv7(),
        sceneId: scene.id,
        assetId: audioAssetId,
        effectIds: [],
        startMs: scene.startMs,
        durationMs: scene.durationMs,
      });
      subtitleClips.push({
        id: uuidv7(),
        sceneId: scene.id,
        assetId: subtitleAssetId,
        effectIds: [],
        startMs: scene.startMs,
        durationMs: scene.durationMs,
      });

      return {
        id: scene.id,
        title: scene.title,
        narration: scene.prompt,
        startMs: scene.startMs,
        durationMs: scene.durationMs,
        trackIds: ["track-video", "track-audio", "track-subtitle"],
        assetIds: [videoAssetId, audioAssetId, subtitleAssetId],
        effectIds: [transitionEffectId],
      };
    });

    return {
      id: projectId,
      name: params.name,
      description: "Auto-generated by pilot workflow",
      createdAt: now,
      updatedAt: now,
      currentVersionId: versionId,
      versions: [
        {
          id: versionId,
          versionNumber: 1,
          createdAt: now,
          createdBy: params.createdBy,
          notes: "Generated from semantic pipeline",
          scenes,
          tracks: [
            {
              id: "track-video",
              kind: "video",
              index: 0,
              clips: videoClips,
            },
            {
              id: "track-audio",
              kind: "audio",
              index: 1,
              clips: audioClips,
            },
            {
              id: "track-subtitle",
              kind: "subtitle",
              index: 2,
              clips: subtitleClips,
            },
          ],
          assets,
          effects,
          exportPresets: [
            {
              id: "preset-social-1080",
              name: "Social 1080p",
              format: "mp4",
              resolution: "1080p",
              fps: 30,
              bitrateKbps: 8000,
              audioCodec: "aac",
            },
          ],
        },
      ],
    };
  }

  private normalizePayload(payload: unknown): PilotWorkflowRequest {
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException({
        message: "Workflow payload must be an object",
      });
    }

    const candidate = payload as {
      idea?: unknown;
      useCase?: unknown;
      requestedBy?: unknown;
      waitForResult?: unknown;
    };

    if (
      typeof candidate.idea !== "string" ||
      candidate.idea.trim().length === 0
    ) {
      throw new BadRequestException({
        message: "idea is required",
      });
    }

    const useCase =
      candidate.useCase === "hook" ||
      candidate.useCase === "one-minute-script" ||
      candidate.useCase === "social-post"
        ? candidate.useCase
        : undefined;

    if (!useCase) {
      throw new BadRequestException({
        message: "useCase must be one of: hook, one-minute-script, social-post",
      });
    }

    if (
      typeof candidate.requestedBy !== "string" ||
      candidate.requestedBy.trim().length === 0
    ) {
      throw new BadRequestException({
        message: "requestedBy is required",
      });
    }

    return {
      idea: candidate.idea,
      useCase,
      requestedBy: candidate.requestedBy,
      waitForResult: candidate.waitForResult !== false,
    };
  }
}
