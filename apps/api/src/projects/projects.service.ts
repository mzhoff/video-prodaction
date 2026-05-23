import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type VideoExportPreset,
  type VideoProject,
  type VideoProjectVersion,
  validateVideoProject,
} from "@repo/api";
import { v7 as uuidv7 } from "uuid";

// biome-ignore lint/style/useImportType: NestJS DI needs runtime class references.
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async createProject(payload: unknown): Promise<VideoProject> {
    const normalizedPayload = this.normalizeIncomingProject(payload);
    const validation = validateVideoProject(normalizedPayload);

    if (!validation.ok) {
      throw new BadRequestException({
        message: "VideoProject validation failed",
        issues: validation.issues,
      });
    }

    try {
      await this.projectsRepository.create(validation.value);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          message: "Project with the same external id already exists",
          projectId: validation.value.id,
        });
      }

      throw error;
    }

    return validation.value;
  }

  async getProject(projectId: string): Promise<VideoProject> {
    return this.requireProject(projectId);
  }

  async listVersions(projectId: string): Promise<VideoProjectVersion[]> {
    const project = await this.requireProject(projectId);
    return [...project.versions].sort(
      (left, right) => right.versionNumber - left.versionNumber,
    );
  }

  async getVersion(
    projectId: string,
    versionId: string,
  ): Promise<VideoProjectVersion> {
    const project = await this.requireProject(projectId);
    const version = project.versions.find((item) => item.id === versionId);
    if (!version) {
      throw new NotFoundException({
        message: "Project version not found",
        projectId,
        versionId,
      });
    }

    return version;
  }

  async createVersion(
    projectId: string,
    payload: unknown,
  ): Promise<VideoProjectVersion> {
    const project = await this.requireProject(projectId);
    const input = this.normalizeVersionPayload(payload);

    const sourceVersion =
      project.versions.find((version) => version.id === input.fromVersionId) ??
      project.versions.find(
        (version) => version.id === project.currentVersionId,
      );

    if (!sourceVersion) {
      throw new BadRequestException({
        message: "Cannot derive base version for clone",
        projectId,
      });
    }

    const nextVersionNumber =
      project.versions.reduce(
        (acc, version) => Math.max(acc, version.versionNumber),
        0,
      ) + 1;
    const createdAt = new Date().toISOString();
    const versionId = uuidv7();

    const clonedVersion: VideoProjectVersion = {
      ...sourceVersion,
      id: versionId,
      versionNumber: nextVersionNumber,
      createdAt,
      createdBy: input.createdBy,
      notes: input.notes ?? sourceVersion.notes,
      scenes:
        input.scenes ?? sourceVersion.scenes.map((scene) => ({ ...scene })),
      tracks:
        input.tracks ??
        sourceVersion.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => ({ ...clip })),
        })),
      assets:
        input.assets ?? sourceVersion.assets.map((asset) => ({ ...asset })),
      effects:
        input.effects ?? sourceVersion.effects.map((effect) => ({ ...effect })),
      exportPresets:
        input.exportPresets ??
        sourceVersion.exportPresets.map((preset) => ({ ...preset })),
    };

    const updatedProject: VideoProject = {
      ...project,
      updatedAt: createdAt,
      currentVersionId: clonedVersion.id,
      versions: [...project.versions, clonedVersion],
    };

    this.assertProjectValid(updatedProject);
    await this.projectsRepository.update(updatedProject);

    return clonedVersion;
  }

  async setCurrentVersion(
    projectId: string,
    versionId: string,
  ): Promise<VideoProject> {
    const project = await this.requireProject(projectId);
    const hasVersion = project.versions.some(
      (version) => version.id === versionId,
    );
    if (!hasVersion) {
      throw new NotFoundException({
        message: "Project version not found",
        projectId,
        versionId,
      });
    }

    const updatedProject: VideoProject = {
      ...project,
      currentVersionId: versionId,
      updatedAt: new Date().toISOString(),
    };

    this.assertProjectValid(updatedProject);
    await this.projectsRepository.update(updatedProject);
    return updatedProject;
  }

  async addExportPreset(
    projectId: string,
    versionId: string,
    payload: unknown,
  ): Promise<VideoProjectVersion> {
    const project = await this.requireProject(projectId);
    const versionIndex = project.versions.findIndex(
      (item) => item.id === versionId,
    );
    if (versionIndex === -1) {
      throw new NotFoundException({
        message: "Project version not found",
        projectId,
        versionId,
      });
    }

    const preset = this.normalizeExportPreset(payload);
    const version = project.versions[versionIndex];
    if (!version) {
      throw new NotFoundException({
        message: "Project version not found",
        projectId,
        versionId,
      });
    }

    const nextVersion: VideoProjectVersion = {
      ...version,
      exportPresets: [...version.exportPresets, preset],
    };

    const nextVersions = [...project.versions];
    nextVersions[versionIndex] = nextVersion;
    const updatedProject: VideoProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      versions: nextVersions,
    };

    this.assertProjectValid(updatedProject);
    await this.projectsRepository.update(updatedProject);

    return nextVersion;
  }

  private normalizeIncomingProject(payload: unknown): unknown {
    if (!this.isObject(payload)) {
      return payload;
    }

    const withId = { ...payload };
    if (typeof withId.id !== "string" || withId.id.trim().length === 0) {
      withId.id = uuidv7();
    }

    if (!Array.isArray(withId.versions) || withId.versions.length === 0) {
      return withId;
    }

    const versionIds = new Set<string>();
    const normalizedVersions = withId.versions.map((version) => {
      if (!this.isObject(version)) {
        return version;
      }

      const nextVersion = { ...version };
      if (
        typeof nextVersion.id !== "string" ||
        nextVersion.id.trim().length === 0
      ) {
        nextVersion.id = uuidv7();
      }

      if (typeof nextVersion.id === "string") {
        versionIds.add(nextVersion.id);
      }
      return nextVersion;
    });

    withId.versions = normalizedVersions;

    if (
      typeof withId.currentVersionId !== "string" ||
      !versionIds.has(withId.currentVersionId)
    ) {
      const firstVersionId = normalizedVersions.find((version) =>
        this.isObject(version),
      ) as { id?: string } | undefined;

      if (typeof firstVersionId?.id === "string") {
        withId.currentVersionId = firstVersionId.id;
      }
    }

    return withId;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.isObject(error) && error.code === "23505";
  }

  private async requireProject(projectId: string): Promise<VideoProject> {
    const project = await this.projectsRepository.findByExternalId(projectId);
    if (!project) {
      throw new NotFoundException({
        message: "Project not found",
        projectId,
      });
    }

    return project;
  }

  private assertProjectValid(project: VideoProject): void {
    const validation = validateVideoProject(project);
    if (!validation.ok) {
      throw new BadRequestException({
        message: "VideoProject validation failed",
        issues: validation.issues,
      });
    }
  }

  private normalizeVersionPayload(payload: unknown): {
    createdBy: string;
    notes?: string;
    fromVersionId?: string;
    scenes?: VideoProjectVersion["scenes"];
    tracks?: VideoProjectVersion["tracks"];
    assets?: VideoProjectVersion["assets"];
    effects?: VideoProjectVersion["effects"];
    exportPresets?: VideoProjectVersion["exportPresets"];
  } {
    if (!this.isObject(payload)) {
      throw new BadRequestException({
        message: "Version payload must be an object",
      });
    }

    const createdBy = payload.createdBy;
    if (typeof createdBy !== "string" || createdBy.trim().length === 0) {
      throw new BadRequestException({
        message: "createdBy is required",
      });
    }

    return {
      createdBy,
      notes: typeof payload.notes === "string" ? payload.notes : undefined,
      fromVersionId:
        typeof payload.fromVersionId === "string" &&
        payload.fromVersionId.length > 0
          ? payload.fromVersionId
          : undefined,
      scenes: Array.isArray(payload.scenes)
        ? (payload.scenes as VideoProjectVersion["scenes"])
        : undefined,
      tracks: Array.isArray(payload.tracks)
        ? (payload.tracks as VideoProjectVersion["tracks"])
        : undefined,
      assets: Array.isArray(payload.assets)
        ? (payload.assets as VideoProjectVersion["assets"])
        : undefined,
      effects: Array.isArray(payload.effects)
        ? (payload.effects as VideoProjectVersion["effects"])
        : undefined,
      exportPresets: Array.isArray(payload.exportPresets)
        ? (payload.exportPresets as VideoProjectVersion["exportPresets"])
        : undefined,
    };
  }

  private normalizeExportPreset(payload: unknown): VideoExportPreset {
    if (!this.isObject(payload)) {
      throw new BadRequestException({
        message: "Export preset payload must be an object",
      });
    }

    const format =
      payload.format === "mp4" ||
      payload.format === "mov" ||
      payload.format === "webm"
        ? payload.format
        : undefined;
    const resolution =
      payload.resolution === "720p" ||
      payload.resolution === "1080p" ||
      payload.resolution === "1440p" ||
      payload.resolution === "2160p"
        ? payload.resolution
        : undefined;
    const audioCodec =
      payload.audioCodec === "aac" || payload.audioCodec === "pcm"
        ? payload.audioCodec
        : undefined;

    if (
      typeof payload.name !== "string" ||
      payload.name.trim().length === 0 ||
      !format ||
      !resolution ||
      !audioCodec ||
      typeof payload.fps !== "number" ||
      payload.fps <= 0 ||
      typeof payload.bitrateKbps !== "number" ||
      payload.bitrateKbps <= 0
    ) {
      throw new BadRequestException({
        message: "Invalid export preset payload",
      });
    }

    return {
      id:
        typeof payload.id === "string" && payload.id.trim().length > 0
          ? payload.id
          : uuidv7(),
      name: payload.name,
      format,
      resolution,
      fps: payload.fps,
      bitrateKbps: payload.bitrateKbps,
      audioCodec,
    };
  }
}
