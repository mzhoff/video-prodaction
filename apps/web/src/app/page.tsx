"use client";

import type {
  RenderJob,
  RenderRequest,
  VideoAsset,
  VideoEffect,
  VideoProject,
  VideoScene,
  VideoTrack,
} from "@repo/api";
import { useEffect, useMemo, useRef, useState } from "react";

type TransitionPreset = "cut" | "crossfade" | "wipe" | "zoom";
type UserRole = "editor" | "reader";

interface EditableScene {
  id: string;
  title: string;
  text: string;
  durationMs: number;
  transition: TransitionPreset;
}

interface ExportStatusResponse {
  exportId: string;
  renderJobId: string;
  status: "processing" | "ready" | "failed";
  downloadUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface ErrorSummary {
  totalLast24h: number;
  byStatusCode: Array<{ statusCode: number; total: number }>;
}

interface ErrorLogItem {
  id: string;
  requestId: string;
  role: UserRole;
  method: string;
  path: string;
  statusCode: number;
  errorCode?: string;
  message: string;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const MS_IN_SECOND = 1000;

const makeId = (prefix: string): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.round(durationMs / MS_IN_SECOND);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const transitionLabel: Record<TransitionPreset, string> = {
  cut: "Cut",
  crossfade: "Crossfade",
  wipe: "Wipe",
  zoom: "Zoom",
};

const initialScenes: EditableScene[] = [
  {
    id: makeId("scene"),
    title: "Hook",
    text: "Покажи боль пользователя и почему текущий монтаж слишком долгий.",
    durationMs: 6000,
    transition: "cut",
  },
  {
    id: makeId("scene"),
    title: "Flow",
    text: "Кратко раскрой, как сценарий превращается в timeline в несколько шагов.",
    durationMs: 9000,
    transition: "crossfade",
  },
  {
    id: makeId("scene"),
    title: "CTA",
    text: "Призыв отправить свой сценарий на пилотную сборку.",
    durationMs: 5000,
    transition: "wipe",
  },
];

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: { role?: UserRole },
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-role": options?.role ?? "editor",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
    code?: string;
  } | null;

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join("; ")
      : (payload?.message ?? `Request failed: ${response.status}`);
    throw new Error(payload?.code ? `${payload.code}: ${message}` : message);
  }

  return payload as T;
}

function buildProjectPayload(
  projectName: string,
  scenes: EditableScene[],
): {
  project: VideoProject;
  projectVersionId: string;
  exportPresetId: string;
} {
  const projectId = makeId("project");
  const versionId = makeId("version");
  const exportPresetId = "preset-social-1080";
  const now = new Date().toISOString();

  const videoTrackClips: VideoTrack["clips"] = [];
  const audioTrackClips: VideoTrack["clips"] = [];
  const subtitleTrackClips: VideoTrack["clips"] = [];

  const assets: VideoAsset[] = [];
  const effects: VideoEffect[] = [];
  const projectScenes: VideoScene[] = [];

  let timelineCursorMs = 0;
  scenes.forEach((scene, index) => {
    const videoAssetId = makeId(`asset-video-${index + 1}`);
    const audioAssetId = makeId(`asset-audio-${index + 1}`);
    const subtitleAssetId = makeId(`asset-subtitle-${index + 1}`);
    const effectId = makeId(`effect-transition-${index + 1}`);

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
          text: scene.text,
        },
      },
    );

    effects.push({
      id: effectId,
      kind: "transition",
      name: transitionLabel[scene.transition],
      params: {
        style: scene.transition,
        durationMs: scene.transition === "cut" ? 120 : 300,
      },
    });

    videoTrackClips.push({
      id: makeId(`clip-video-${index + 1}`),
      sceneId: scene.id,
      assetId: videoAssetId,
      effectIds: [effectId],
      startMs: timelineCursorMs,
      durationMs: scene.durationMs,
    });

    audioTrackClips.push({
      id: makeId(`clip-audio-${index + 1}`),
      sceneId: scene.id,
      assetId: audioAssetId,
      effectIds: [],
      startMs: timelineCursorMs,
      durationMs: scene.durationMs,
    });

    subtitleTrackClips.push({
      id: makeId(`clip-subtitle-${index + 1}`),
      sceneId: scene.id,
      assetId: subtitleAssetId,
      effectIds: [],
      startMs: timelineCursorMs,
      durationMs: scene.durationMs,
    });

    projectScenes.push({
      id: scene.id,
      title: scene.title,
      narration: scene.text,
      startMs: timelineCursorMs,
      durationMs: scene.durationMs,
      trackIds: ["track-video", "track-audio", "track-subtitle"],
      assetIds: [videoAssetId, audioAssetId, subtitleAssetId],
      effectIds: [effectId],
    });

    timelineCursorMs += scene.durationMs;
  });

  const tracks: VideoTrack[] = [
    {
      id: "track-video",
      kind: "video",
      index: 0,
      clips: videoTrackClips,
    },
    {
      id: "track-audio",
      kind: "audio",
      index: 1,
      clips: audioTrackClips,
    },
    {
      id: "track-subtitle",
      kind: "subtitle",
      index: 2,
      clips: subtitleTrackClips,
    },
  ];

  const project: VideoProject = {
    id: projectId,
    name: projectName.trim(),
    description: "Stage-6 Product Minimum draft",
    createdAt: now,
    updatedAt: now,
    currentVersionId: versionId,
    versions: [
      {
        id: versionId,
        versionNumber: 1,
        createdAt: now,
        createdBy: "operator@video-action.local",
        notes: "Created via frontend editor v1.0",
        scenes: projectScenes,
        tracks,
        assets,
        effects,
        exportPresets: [
          {
            id: exportPresetId,
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

  return {
    project,
    projectVersionId: versionId,
    exportPresetId,
  };
}

export default function Home() {
  const [projectName, setProjectName] = useState("Video pipeline demo");
  const [scenes, setScenes] = useState<EditableScene[]>(initialScenes);
  const [priority, setPriority] = useState<RenderRequest["priority"]>("normal");
  const [userRole, setUserRole] = useState<UserRole>("editor");

  const [createdProject, setCreatedProject] = useState<VideoProject | null>(
    null,
  );
  const [apiProject, setApiProject] = useState<VideoProject | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatusResponse | null>(
    null,
  );

  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const totalDurationMs = useMemo(
    () => scenes.reduce((acc, scene) => acc + scene.durationMs, 0),
    [scenes],
  );

  const transitionSummary = useMemo(() => {
    const summary = new Map<TransitionPreset, number>();
    scenes.forEach((scene) => {
      summary.set(scene.transition, (summary.get(scene.transition) ?? 0) + 1);
    });

    return Array.from(summary.entries())
      .map(([transition, count]) => `${transitionLabel[transition]}: ${count}`)
      .join(" · ");
  }, [scenes]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const refreshProject = async (projectId: string): Promise<void> => {
    const project = await requestJson<VideoProject>(
      `/projects/${projectId}`,
      undefined,
      {
        role: userRole,
      },
    );
    setApiProject(project);
  };

  const refreshErrorDashboard = async (): Promise<void> => {
    const [summary, logs] = await Promise.all([
      requestJson<ErrorSummary>("/ops/errors/summary", undefined, {
        role: userRole,
      }),
      requestJson<ErrorLogItem[]>("/ops/errors?limit=12", undefined, {
        role: userRole,
      }),
    ]);

    setErrorSummary(summary);
    setErrorLogs(logs);
  };

  const updateScene = (
    sceneId: string,
    patch: Partial<EditableScene>,
  ): void => {
    setScenes((previous) =>
      previous.map((scene) =>
        scene.id === sceneId ? { ...scene, ...patch } : scene,
      ),
    );
  };

  const addScene = (): void => {
    setScenes((previous) => [
      ...previous,
      {
        id: makeId("scene"),
        title: `Scene ${previous.length + 1}`,
        text: "Новый текст сцены",
        durationMs: 6000,
        transition: "cut",
      },
    ]);
  };

  const removeScene = (sceneId: string): void => {
    setScenes((previous) => {
      if (previous.length === 1) {
        return previous;
      }

      return previous.filter((scene) => scene.id !== sceneId);
    });
  };

  const runAssembly = async (): Promise<void> => {
    if (projectName.trim().length < 3) {
      setErrorMessage("Название проекта должно быть длиннее 2 символов.");
      return;
    }

    if (
      scenes.some(
        (scene) => scene.durationMs < 1000 || scene.title.trim().length < 2,
      )
    ) {
      setErrorMessage(
        "Проверь сцены: имя >= 2 символа и длительность >= 1000 мс.",
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setRenderJob(null);
    setExportStatus(null);

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      const { project, projectVersionId, exportPresetId } = buildProjectPayload(
        projectName,
        scenes,
      );
      const persistedProject = await requestJson<VideoProject>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify(project),
        },
        {
          role: userRole,
        },
      );
      setCreatedProject(persistedProject);

      await refreshProject(persistedProject.id);

      const renderRequest: RenderRequest = {
        requestId: makeId("request"),
        projectId: persistedProject.id,
        projectVersionId,
        exportPresetId,
        requestedBy: "operator@video-action.local",
        requestedAt: new Date().toISOString(),
        priority,
      };

      const createdRenderJob = await requestJson<RenderJob>(
        "/render-jobs",
        {
          method: "POST",
          body: JSON.stringify(renderRequest),
        },
        {
          role: userRole,
        },
      );

      setRenderJob(createdRenderJob);

      pollTimerRef.current = window.setInterval(async () => {
        try {
          const nextJob = await requestJson<RenderJob>(
            `/render-jobs/${createdRenderJob.id}`,
            undefined,
            {
              role: userRole,
            },
          );
          setRenderJob(nextJob);

          if (nextJob.status === "done" || nextJob.status === "failed") {
            const status = await requestJson<ExportStatusResponse>(
              `/exports/${nextJob.id}`,
              undefined,
              {
                role: userRole,
              },
            );
            setExportStatus(status);

            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        } catch (error) {
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось получить статус рендера.",
          );
        }
      }, 1000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка запуска сборки.",
      );
    } finally {
      setLoading(false);
      void refreshErrorDashboard().catch(() => undefined);
    }
  };

  const createVersionFromCurrent = async (): Promise<void> => {
    if (!apiProject) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await requestJson<VideoProject["versions"][number]>(
        `/projects/${apiProject.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({
            createdBy: "operator@video-action.local",
            notes: "Created from frontend product minimum panel",
          }),
        },
        {
          role: userRole,
        },
      );

      await refreshProject(apiProject.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать версию.",
      );
    } finally {
      setLoading(false);
    }
  };

  const addPresetToCurrentVersion = async (): Promise<void> => {
    if (!apiProject) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await requestJson<VideoProject["versions"][number]>(
        `/projects/${apiProject.id}/versions/${apiProject.currentVersionId}/export-presets`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Pilot 720p Fast",
            format: "mp4",
            resolution: "720p",
            fps: 24,
            bitrateKbps: 4000,
            audioCodec: "aac",
          }),
        },
        {
          role: userRole,
        },
      );

      await refreshProject(apiProject.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось добавить пресет.",
      );
    } finally {
      setLoading(false);
    }
  };

  const switchVersion = async (versionId: string): Promise<void> => {
    if (!apiProject) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await requestJson<VideoProject>(
        `/projects/${apiProject.id}/current-version`,
        {
          method: "PUT",
          body: JSON.stringify({ versionId }),
        },
        {
          role: userRole,
        },
      );

      await refreshProject(apiProject.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось переключить версию.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{ margin: "0 auto", maxWidth: 1180, padding: "28px 20px 42px" }}
    >
      <section
        style={{
          border: "1px solid var(--line)",
          background:
            "linear-gradient(130deg, var(--card) 0%, var(--card-soft) 100%)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 18px 50px rgb(5 12 26 / 30%)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono), monospace",
            color: "var(--accent)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Product minimum v1.0
        </p>
        <h1
          style={{ margin: "8px 0 10px", fontSize: "clamp(28px, 5vw, 42px)" }}
        >
          Идея → проект → рендер → файл
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--muted)",
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          Редактор сцены, минимальные роли доступа, версии проекта, пресеты
          экспорта и мониторинг ошибок API.
        </p>
      </section>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        }}
      >
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Сцены
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 26 }}>{scenes.length}</p>
        </article>
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Общая длительность
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 26 }}>
            {formatDuration(totalDurationMs)}
          </p>
        </article>
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Переходы
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 17 }}>{transitionSummary}</p>
        </article>
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 18,
          background: "var(--card)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 14,
            }}
            htmlFor="role"
          >
            Роль:
            <select
              id="role"
              value={userRole}
              onChange={(event) => {
                setUserRole(event.target.value as UserRole);
              }}
              style={{
                borderRadius: 8,
                border: "1px solid var(--line)",
                padding: "8px 10px",
                color: "var(--text)",
                background: "#0b1628",
              }}
            >
              <option value="editor">editor</option>
              <option value="reader">reader</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              void refreshErrorDashboard().catch((error) => {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Не удалось загрузить ops dashboard.",
                );
              });
            }}
            style={{
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "#132440",
              color: "var(--text)",
              padding: "9px 12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Обновить dashboard ошибок
          </button>
        </div>

        <label
          style={{
            display: "block",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 6,
            marginTop: 12,
          }}
          htmlFor="project-name"
        >
          Название проекта
        </label>
        <input
          id="project-name"
          value={projectName}
          onChange={(event) => {
            setProjectName(event.target.value);
          }}
          style={{
            width: "100%",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "#0b1628",
            color: "var(--text)",
            padding: "10px 12px",
            fontSize: 16,
          }}
        />

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 14,
            }}
            htmlFor="priority"
          >
            Приоритет рендера:
            <select
              id="priority"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value as RenderRequest["priority"]);
              }}
              style={{
                borderRadius: 8,
                border: "1px solid var(--line)",
                padding: "8px 10px",
                color: "var(--text)",
                background: "#0b1628",
              }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>

          <button
            type="button"
            onClick={addScene}
            style={{
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "#132440",
              color: "var(--text)",
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Добавить сцену
          </button>

          <button
            type="button"
            onClick={() => {
              void runAssembly();
            }}
            disabled={loading}
            style={{
              borderRadius: 10,
              border: "none",
              background:
                "linear-gradient(120deg, var(--accent), var(--accent-2))",
              color: "#052018",
              padding: "11px 16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? "Запуск..." : "Запустить сборку"}
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {scenes.map((scene, index) => (
          <article
            key={scene.id}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 14,
              background: "linear-gradient(180deg, #0f1a2d 0%, #0a1221 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: 18 }}>Сцена {index + 1}</strong>
              <button
                type="button"
                onClick={() => {
                  removeScene(scene.id);
                }}
                disabled={scenes.length === 1}
                style={{
                  borderRadius: 8,
                  border: "1px solid #4f2a3a",
                  color: "#ff9db1",
                  background: "#22111a",
                  padding: "7px 10px",
                  cursor: scenes.length === 1 ? "not-allowed" : "pointer",
                }}
              >
                Удалить
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  Название
                </span>
                <input
                  value={scene.title}
                  onChange={(event) => {
                    updateScene(scene.id, { title: event.target.value });
                  }}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#091527",
                    color: "var(--text)",
                    padding: "9px 11px",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  Длительность (мс)
                </span>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={scene.durationMs}
                  onChange={(event) => {
                    const nextDuration = Number(event.target.value);
                    updateScene(scene.id, {
                      durationMs: Number.isFinite(nextDuration)
                        ? Math.max(1000, nextDuration)
                        : 1000,
                    });
                  }}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#091527",
                    color: "var(--text)",
                    padding: "9px 11px",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  Переход
                </span>
                <select
                  value={scene.transition}
                  onChange={(event) => {
                    updateScene(scene.id, {
                      transition: event.target.value as TransitionPreset,
                    });
                  }}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#091527",
                    color: "var(--text)",
                    padding: "9px 11px",
                  }}
                >
                  <option value="cut">Cut</option>
                  <option value="crossfade">Crossfade</option>
                  <option value="wipe">Wipe</option>
                  <option value="zoom">Zoom</option>
                </select>
              </label>
            </div>

            <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Текст сцены / narration
              </span>
              <textarea
                value={scene.text}
                onChange={(event) => {
                  updateScene(scene.id, { text: event.target.value });
                }}
                rows={3}
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "#091527",
                  color: "var(--text)",
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
            </label>
          </article>
        ))}
      </section>

      {errorMessage ? (
        <section
          style={{
            marginTop: 16,
            border: "1px solid #6d3146",
            borderRadius: 12,
            background: "#2b1520",
            padding: 12,
            color: "#ffc2cf",
          }}
        >
          {errorMessage}
        </section>
      ) : null}

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
            Состояние API-проекта
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            {apiProject
              ? `projectId: ${apiProject.id}, version: ${apiProject.currentVersionId}`
              : "Проект еще не создан"}
          </p>
          {apiProject ? (
            <>
              <pre
                style={{
                  marginTop: 10,
                  background: "#0a1321",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 10,
                  overflow: "auto",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(
                  {
                    id: apiProject.id,
                    name: apiProject.name,
                    currentVersionId: apiProject.currentVersionId,
                    versions: apiProject.versions.map((version) => ({
                      id: version.id,
                      number: version.versionNumber,
                      presets: version.exportPresets.length,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    void createVersionFromCurrent();
                  }}
                  disabled={loading || userRole === "reader"}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#132440",
                    color: "var(--text)",
                    padding: "8px 10px",
                  }}
                >
                  + Новая версия
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void addPresetToCurrentVersion();
                  }}
                  disabled={loading || userRole === "reader"}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#132440",
                    color: "var(--text)",
                    padding: "8px 10px",
                  }}
                >
                  + Preset к текущей версии
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const latest = [...apiProject.versions].sort(
                      (a, b) => b.versionNumber - a.versionNumber,
                    )[0];
                    if (latest) {
                      void switchVersion(latest.id);
                    }
                  }}
                  disabled={loading || userRole === "reader"}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#132440",
                    color: "var(--text)",
                    padding: "8px 10px",
                  }}
                >
                  Сделать latest текущей
                </button>
              </div>
            </>
          ) : null}
        </article>

        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
            Состояние рендера
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            {renderJob
              ? `jobId: ${renderJob.id}, status: ${renderJob.status}`
              : "Рендер еще не запущен"}
          </p>

          {createdProject ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              Создан проект: <code>{createdProject.id}</code>
            </p>
          ) : null}

          {exportStatus ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                Экспорт: {exportStatus.status.toUpperCase()}
              </p>
              {exportStatus.downloadUrl ? (
                <a
                  href={exportStatus.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "var(--accent)",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {exportStatus.downloadUrl}
                </a>
              ) : null}
              {exportStatus.errorMessage ? (
                <p style={{ marginTop: 8, color: "#ffb7c4" }}>
                  {exportStatus.errorCode}: {exportStatus.errorMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>

        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
            Ops: ошибки API
          </h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            За 24ч: {errorSummary?.totalLast24h ?? 0}
          </p>
          <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            {errorSummary?.byStatusCode
              .map((item) => `${item.statusCode}: ${item.total}`)
              .join(" · ") ?? "нет данных"}
          </p>

          <div
            style={{
              marginTop: 8,
              maxHeight: 180,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {errorLogs.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>Логов пока нет</p>
            ) : (
              errorLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    borderTop: "1px dashed var(--line)",
                    padding: "8px 0",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono), monospace" }}>
                    {log.statusCode} {log.method} {log.path}
                  </div>
                  <div style={{ color: "var(--muted)" }}>{log.message}</div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
