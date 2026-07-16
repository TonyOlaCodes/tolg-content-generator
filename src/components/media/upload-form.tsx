"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useState } from "react";

import { TagPicker } from "@/components/media/tag-picker";
import type { TagOption } from "@/components/media/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTagsAction } from "@/server/actions/tags";

type MediaType = "THEME_IMAGE" | "PHYSIQUE_PHOTO" | "MUSIC";

type FileStatus = {
  name: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

const TYPE_LABELS: Record<MediaType, string> = {
  THEME_IMAGE: "Theme image",
  PHYSIQUE_PHOTO: "Physique photo",
  MUSIC: "Music",
};

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

async function makeThumbnailBlob(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 400;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.82);
    });
  } catch {
    return null;
  }
}

async function getAudioDurationMs(file: File): Promise<number | null> {
  if (!file.type.startsWith("audio/")) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const ms = Number.isFinite(audio.duration)
        ? Math.round(audio.duration * 1000)
        : null;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

export function UploadForm() {
  const [mediaType, setMediaType] = useState<MediaType>("THEME_IMAGE");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [pending, setPending] = useState(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const file of list) {
        const key = `${file.name}:${file.size}`;
        if (!names.has(key)) next.push(file);
      }
      return next;
    });
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }

  function resetMeta() {
    setYear("");
    setDescription("");
    setTitle("");
    setTagIds([]);
    setCustomTags([]);
  }

  function handleTypeChange(next: MediaType) {
    setMediaType(next);
    resetMeta();
  }

  async function ensureTagsLoaded() {
    if (tagsLoaded) return;
    const rows = await getTagsAction();
    setTags(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        isSystem: t.isSystem,
      })),
    );
    setTagsLoaded(true);
  }

  async function toggleTags() {
    const next = !showTags;
    setShowTags(next);
    if (next) {
      try {
        await ensureTagsLoaded();
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Could not load tags",
        );
      }
    }
  }

  async function handleUpload() {
    if (files.length === 0) {
      setGlobalError("Select at least one file to upload.");
      return;
    }
    if (mediaType === "MUSIC" && !title.trim()) {
      setGlobalError("Music uploads require a title.");
      return;
    }

    setGlobalError(null);
    setPending(true);
    setStatuses(files.map((f) => ({ name: f.name, status: "pending" })));
    const nextStatuses: FileStatus[] = [];

    try {
      for (const file of files) {
        nextStatuses.push({ name: file.name, status: "uploading" });
        setStatuses([...nextStatuses]);

        try {
          const folder =
            mediaType === "THEME_IMAGE"
              ? "tolg/theme"
              : mediaType === "PHYSIQUE_PHOTO"
                ? "tolg/physique"
                : "tolg/music";

          const [contentHash, dims, thumbBlob, durationMs] = await Promise.all([
            sha256Hex(file),
            getImageDimensions(file),
            makeThumbnailBlob(file),
            getAudioDurationMs(file),
          ]);

          const blob = await upload(`${folder}/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/media/blob",
            multipart: file.size > 4 * 1024 * 1024,
          });

          let thumbnailUrl: string | null = null;
          if (thumbBlob) {
            const thumb = await upload(
              `tolg/thumbs/${contentHash.slice(0, 16)}.webp`,
              thumbBlob,
              {
                access: "public",
                handleUploadUrl: "/api/media/blob",
              },
            );
            thumbnailUrl = thumb.url;
          }

          const yearParsed = year.trim() ? Number(year.trim()) : null;

          const response = await fetch("/api/media/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: mediaType,
              blobUrl: blob.url,
              pathname: blob.pathname,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              contentHash,
              width: dims?.width ?? null,
              height: dims?.height ?? null,
              thumbnailUrl,
              durationMs,
              year:
                mediaType === "PHYSIQUE_PHOTO" &&
                yearParsed !== null &&
                Number.isFinite(yearParsed)
                  ? yearParsed
                  : null,
              title:
                mediaType === "MUSIC"
                  ? title.trim() || file.name
                  : undefined,
              description:
                mediaType === "THEME_IMAGE" ? description || undefined : undefined,
              tagIds,
              customTags,
            }),
          });

          const text = await response.text();
          let result: { ok?: boolean; error?: string } = {};
          try {
            result = JSON.parse(text) as { ok?: boolean; error?: string };
          } catch {
            result = {
              ok: false,
              error: text.slice(0, 160) || `Upload failed (${response.status})`,
            };
          }

          if (!response.ok || !result.ok) {
            throw new Error(result.error || `Upload failed (${response.status})`);
          }

          nextStatuses[nextStatuses.length - 1] = {
            name: file.name,
            status: "success",
          };
        } catch (err) {
          nextStatuses[nextStatuses.length - 1] = {
            name: file.name,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }

        setStatuses([...nextStatuses]);
      }

      if (nextStatuses.every((s) => s.status === "success")) {
        setFiles([]);
        resetMeta();
        setShowTags(false);
      }
    } finally {
      setPending(false);
    }
  }

  const tagCategories =
    mediaType === "THEME_IMAGE"
      ? ["THEME_MOOD", "THEME_STYLE", "THEME_CONCEPT", "CUSTOM"]
      : mediaType === "PHYSIQUE_PHOTO"
        ? [
            "TIME",
            "PHASE",
            "QUALITY",
            "PHYSIQUE",
            "POSE",
            "ANGLE",
            "LOCATION",
            "EXPRESSION",
            "CUSTOM",
          ]
        : ["MUSIC_MOOD", "CUSTOM"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Upload
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Files upload directly to storage (supports larger photos). Prefer
          JPEG/PNG.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Media type</CardTitle>
          <CardDescription>Choose what you are uploading.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABELS) as MediaType[]).map((key) => (
              <Button
                key={key}
                type="button"
                variant={mediaType === key ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange(key)}
              >
                {TYPE_LABELS[key]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>Drag and drop or browse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
              dragging
                ? "border-zinc-400 bg-zinc-900"
                : "border-zinc-700 bg-zinc-950/50"
            }`}
          >
            <p className="text-sm text-zinc-300">
              Drop files here, or choose from disk
            </p>
            <Label htmlFor="file-input" className="mt-3 cursor-pointer">
              <span className="inline-flex h-9 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm text-zinc-100 hover:bg-zinc-800">
                Browse files
              </span>
            </Label>
            <Input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              accept={
                mediaType === "MUSIC"
                  ? "audio/*,.mp3,.wav,.m4a"
                  : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              }
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="space-y-1 text-sm text-zinc-400">
              {files.map((f) => (
                <li
                  key={`${f.name}:${f.size}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">
                    {f.name}{" "}
                    <span className="text-zinc-600">
                      ({(f.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setFiles((prev) =>
                        prev.filter(
                          (x) => !(x.name === f.name && x.size === f.size),
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Optional fields for this batch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mediaType === "PHYSIQUE_PHOTO" ? (
            <div className="space-y-2">
              <Label htmlFor="upload-year">Year</Label>
              <Input
                id="upload-year"
                type="number"
                min={1950}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2023"
              />
            </div>
          ) : null}

          {mediaType === "THEME_IMAGE" ? (
            <div className="space-y-2">
              <Label htmlFor="upload-description">Description</Label>
              <Textarea
                id="upload-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          ) : null}

          {mediaType === "MUSIC" ? (
            <div className="space-y-2">
              <Label htmlFor="upload-title">Title</Label>
              <Input
                id="upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track title (required)"
                required
              />
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void toggleTags()}
          >
            {showTags ? "Hide tags" : "Add tags (optional)"}
          </Button>

          {showTags ? (
            <TagPicker
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              categories={tagCategories}
              allowCustom
              customTags={customTags}
              onCustomTagsChange={setCustomTags}
              label={
                mediaType === "THEME_IMAGE"
                  ? "Mood tags"
                  : "Tags (before save)"
              }
            />
          ) : null}
        </CardContent>
      </Card>

      {globalError ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {globalError}
        </p>
      ) : null}

      {statuses.length > 0 ? (
        <ul className="space-y-2 rounded-lg border border-zinc-800 p-3 text-sm">
          {statuses.map((s) => (
            <li key={s.name} className="flex justify-between gap-2">
              <span className="truncate text-zinc-300">{s.name}</span>
              <span
                className={
                  s.status === "success"
                    ? "text-emerald-400"
                    : s.status === "error"
                      ? "text-red-400"
                      : "text-zinc-500"
                }
              >
                {s.status === "error" ? s.error ?? "Error" : s.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={pending || files.length === 0}
        title={files.length === 0 ? "Add files first" : undefined}
        onClick={() => void handleUpload()}
      >
        {pending
          ? "Uploading…"
          : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
