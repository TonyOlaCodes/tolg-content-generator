"use client";

import { useState, useTransition } from "react";

import { TagPicker } from "@/components/media/tag-picker";
import type { MediaAssetItem, TagOption } from "@/components/media/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMediaTagsAction } from "@/server/actions/media";

type MediaEditPanelProps = {
  item: MediaAssetItem;
  tags: TagOption[];
  onClose: () => void;
  onSaved: () => void;
};

function tagCategoriesForType(
  type: MediaAssetItem["type"],
): string[] | undefined {
  if (type === "THEME_IMAGE") {
    return ["THEME_MOOD", "THEME_STYLE", "THEME_CONCEPT", "CUSTOM"];
  }
  if (type === "PHYSIQUE_PHOTO") {
    return [
      "TIME",
      "PHASE",
      "QUALITY",
      "PHYSIQUE",
      "POSE",
      "ANGLE",
      "LOCATION",
      "EXPRESSION",
      "CUSTOM",
    ];
  }
  if (type === "MUSIC") {
    return ["MUSIC_MOOD", "CUSTOM"];
  }
  return undefined;
}

export function MediaEditPanel({
  item,
  tags,
  onClose,
  onSaved,
}: MediaEditPanelProps) {
  const [tagIds, setTagIds] = useState(
    item.mediaTags.map((mt) => mt.tagId),
  );
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [year, setYear] = useState(
    item.physiqueMetadata?.year?.toString() ?? "",
  );
  const [description, setDescription] = useState(
    item.themeMetadata?.description ?? "",
  );
  const [musicTitle, setMusicTitle] = useState(
    item.musicMetadata?.title ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMediaTagsAction({
          mediaId: item.id,
          tagIds,
          customTags,
          year:
            item.type === "PHYSIQUE_PHOTO"
              ? year
                ? Number(year)
                : null
              : undefined,
          description:
            item.type === "THEME_IMAGE" ? description || null : undefined,
          musicTitle: item.type === "MUSIC" ? musicTitle : undefined,
        });
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">Edit media</h2>
          <p className="truncate text-xs text-zinc-500">{item.fileName}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {item.type === "PHYSIQUE_PHOTO" ? (
          <div className="space-y-2">
            <Label htmlFor="edit-year">Year</Label>
            <Input
              id="edit-year"
              type="number"
              min={1950}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2024"
            />
          </div>
        ) : null}

        {item.type === "THEME_IMAGE" ? (
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the theme image"
              rows={4}
            />
          </div>
        ) : null}

        {item.type === "MUSIC" ? (
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={musicTitle}
              onChange={(e) => setMusicTitle(e.target.value)}
              placeholder="Track title"
            />
          </div>
        ) : null}

        <TagPicker
          tags={tags}
          selectedIds={tagIds}
          onChange={setTagIds}
          categories={tagCategoriesForType(item.type)}
          allowCustom
          customTags={customTags}
          onCustomTagsChange={setCustomTags}
          label={item.type === "THEME_IMAGE" ? "Mood / style tags" : "Tags"}
        />

        {error ? (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2 border-t border-zinc-800 p-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
