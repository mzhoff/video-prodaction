import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type VideoProject, validateVideoProject } from "@repo/api";
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
    const project = await this.projectsRepository.findByExternalId(projectId);
    if (!project) {
      throw new NotFoundException({
        message: "Project not found",
        projectId,
      });
    }

    return project;
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
}
