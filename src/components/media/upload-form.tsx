"use client";

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

type UploadApiResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

const TYPE_LABELS: Record<MediaType, string> = {
  THEME_IMAGE: "Theme image",
  PHYSIQUE_PHOTO: "Physique photo",
  MUSIC: "Music",
};

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

        const formData = new FormData();
        formData.set("file", file);
        formData.set("type", mediaType);
        formData.set("tagIds", JSON.stringify(tagIds));
        formData.set("customTags", JSON.stringify(customTags));

        if (mediaType === "PHYSIQUE_PHOTO" && year) {
          formData.set("year", year);
        }
        if (mediaType === "THEME_IMAGE" && description) {
          formData.set("description", description);
        }
        if (mediaType === "MUSIC") {
          formData.set("title", title.trim() || file.name);
        }

        let result: UploadApiResult;
        try {
          const response = await fetch("/api/media/upload", {
            method: "POST",
            body: formData,
          });
          result = (await response.json()) as UploadApiResult;
          if (!response.ok && !result.error) {
            result = {
              ok: false,
              error: `Upload failed (${response.status})`,
            };
          }
        } catch (err) {
          result = {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Network error during upload",
          };
        }

        nextStatuses[nextStatuses.length - 1] = result.ok
          ? { name: file.name, status: "success" }
          : {
              name: file.name,
              status: "error",
              error: result.error ?? "Upload failed",
            };
        setStatuses([...nextStatuses]);
      }

      const allOk = nextStatuses.every((s) => s.status === "success");
      if (allOk) {
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
          Add theme images, physique photos, or music. You can tag later in
          Media Library.
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
          <CardDescription>
            Drag and drop or browse. Prefer JPEG or PNG.
          </CardDescription>
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
                  <span className="truncate">{f.name}</span>
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
