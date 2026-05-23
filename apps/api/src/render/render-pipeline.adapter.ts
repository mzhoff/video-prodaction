import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { Injectable } from "@nestjs/common";
import type {
  RenderArtifact,
  RenderRequest,
  VideoProject,
  VideoProjectVersion,
} from "@repo/api";

interface RenderPipelineArtifacts {
  exportUrl: string;
  artifacts: RenderArtifact[];
  durationMs: number;
}

interface RenderInputScene {
  id: string;
  title: string;
  narration?: string;
  startMs: number;
  durationMs: number;
}

interface RenderInputPlan {
  jobId: string;
  projectId: string;
  projectVersionId: string;
  totalDurationMs: number;
  resolution: string;
  fps: number;
  scenes: RenderInputScene[];
}

@Injectable()
export class RenderPipelineAdapter {
  private readonly artifactsRoot = resolve(
    process.cwd(),
    "artifacts",
    "renders",
  );
  private readonly driver = process.env.RENDER_PIPELINE_DRIVER ?? "auto";

  async execute(params: {
    jobId: string;
    project: VideoProject;
    request: RenderRequest;
  }): Promise<RenderPipelineArtifacts> {
    const startedAt = Date.now();
    const version = this.findVersion(
      params.project,
      params.request.projectVersionId,
    );

    const projectDir = sanitizeSegment(params.project.id);
    const versionDir = sanitizeSegment(version.id);
    const jobDir = sanitizeSegment(params.jobId);
    const relativeDir = join("renders", projectDir, versionDir, jobDir);
    const absoluteDir = resolve(
      this.artifactsRoot,
      projectDir,
      versionDir,
      jobDir,
    );

    await mkdir(absoluteDir, { recursive: true });

    const renderInputPath = join(absoluteDir, "render-input.json");
    const logPath = join(absoluteDir, "pipeline.log");
    const outputFileName = `${params.jobId}.mp4`;
    const outputPath = join(absoluteDir, outputFileName);

    const inputPlan = this.buildInputPlan({
      jobId: params.jobId,
      projectId: params.project.id,
      version,
    });

    await writeFile(
      renderInputPath,
      `${JSON.stringify(inputPlan, null, 2)}\n`,
      "utf8",
    );

    const durationSeconds = Math.max(
      1,
      Math.ceil(inputPlan.totalDurationMs / 1000),
    );

    try {
      await this.runFfmpegPipeline({
        outputPath,
        durationSeconds,
        logPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeFile(logPath, `Render pipeline failed\n${message}\n`, "utf8");
      throw error;
    }

    const elapsedMs = Date.now() - startedAt;

    return {
      exportUrl: `/${toPosix(join("artifacts", relativeDir, outputFileName))}`,
      artifacts: [
        {
          kind: "video",
          url: `/${toPosix(join("artifacts", relativeDir, outputFileName))}`,
        },
        {
          kind: "timeline",
          url: `/${toPosix(join("artifacts", relativeDir, "render-input.json"))}`,
        },
        {
          kind: "log",
          url: `/${toPosix(join("artifacts", relativeDir, "pipeline.log"))}`,
        },
      ],
      durationMs: elapsedMs,
    };
  }

  private findVersion(
    project: VideoProject,
    versionId: string,
  ): VideoProjectVersion {
    const version = project.versions.find((item) => item.id === versionId);
    if (!version) {
      throw new Error(
        `Project version '${versionId}' was not found in project '${project.id}'`,
      );
    }

    return version;
  }

  private buildInputPlan(params: {
    jobId: string;
    projectId: string;
    version: VideoProjectVersion;
  }): RenderInputPlan {
    const totalDurationMs = params.version.scenes.reduce(
      (acc, scene) => acc + scene.durationMs,
      0,
    );

    const firstPreset = params.version.exportPresets[0];
    const resolution = firstPreset?.resolution ?? "1080p";
    const fps = firstPreset?.fps ?? 30;

    return {
      jobId: params.jobId,
      projectId: params.projectId,
      projectVersionId: params.version.id,
      totalDurationMs,
      resolution,
      fps,
      scenes: params.version.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        narration: scene.narration,
        startMs: scene.startMs,
        durationMs: scene.durationMs,
      })),
    };
  }

  private async runFfmpegPipeline(params: {
    outputPath: string;
    durationSeconds: number;
    logPath: string;
  }): Promise<void> {
    const strategy = this.driver;

    if (strategy === "local") {
      await this.runFfmpegLocal(params);
      return;
    }

    if (strategy === "container") {
      await this.runFfmpegInContainer(params);
      return;
    }

    try {
      await this.runFfmpegLocal(params);
    } catch {
      await this.runFfmpegInContainer(params);
    }
  }

  private async runFfmpegLocal(params: {
    outputPath: string;
    durationSeconds: number;
    logPath: string;
  }): Promise<void> {
    const ffmpegBinary = process.env.FFMPEG_BIN ?? "ffmpeg";

    const args = buildFfmpegArgs({
      durationSeconds: params.durationSeconds,
      outputPath: params.outputPath,
    });

    const result = await runProcess(ffmpegBinary, args);

    await writeFile(
      params.logPath,
      [
        `driver: local`,
        `command: ${ffmpegBinary} ${args.join(" ")}`,
        "--- stdout ---",
        result.stdout,
        "--- stderr ---",
        result.stderr,
      ].join("\n"),
      "utf8",
    );

    await access(params.outputPath);
  }

  private async runFfmpegInContainer(params: {
    outputPath: string;
    durationSeconds: number;
    logPath: string;
  }): Promise<void> {
    const dockerBinary = process.env.DOCKER_BIN ?? "docker";
    const image =
      process.env.RENDER_PIPELINE_IMAGE ?? "jrottenberg/ffmpeg:6.0-ubuntu";

    const outputDir = dirname(params.outputPath);
    const outputName = basename(params.outputPath);

    await this.ensureDockerAvailable(dockerBinary);

    const ffmpegArgs = [
      "run",
      "--rm",
      "-v",
      `${outputDir}:/work`,
      image,
      ...buildFfmpegArgs({
        durationSeconds: params.durationSeconds,
        outputPath: `/work/${outputName}`,
      }),
    ];

    const result = await runProcess(dockerBinary, ffmpegArgs);

    await writeFile(
      params.logPath,
      [
        "driver: container",
        `command: ${dockerBinary} ${ffmpegArgs.join(" ")}`,
        "--- stdout ---",
        result.stdout,
        "--- stderr ---",
        result.stderr,
      ].join("\n"),
      "utf8",
    );

    await access(params.outputPath);
  }

  private async ensureDockerAvailable(binary: string): Promise<void> {
    await runProcess(binary, ["--version"]);
  }
}

const sanitizeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_");

const toPosix = (input: string): string => input.replaceAll(/\\/g, "/");

const buildFfmpegArgs = (params: {
  durationSeconds: number;
  outputPath: string;
}): string[] => [
  "-y",
  "-f",
  "lavfi",
  "-i",
  `color=c=#101820:s=1280x720:d=${params.durationSeconds}`,
  "-f",
  "lavfi",
  "-i",
  "anullsrc=r=48000:cl=stereo",
  "-shortest",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-t",
  String(params.durationSeconds),
  params.outputPath,
];

const runProcess = (
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Process '${command}' exited with code ${code}. stderr: ${stderr}`,
        ),
      );
    });
  });
