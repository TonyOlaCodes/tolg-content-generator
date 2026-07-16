"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Music } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatAspectRatio } from "@/lib/utils";
import type { MediaAssetItem } from "@/components/media/types";

type MediaCardProps = {
  item: MediaAssetItem;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function MediaCard({
  item,
  selected,
  onSelectChange,
  onEdit,
  onDelete,
}: MediaCardProps) {
  const created =
    typeof item.createdAt === "string"
      ? new Date(item.createdAt)
      : item.createdAt;
  const lastUsed = item.lastUsedAt
    ? typeof item.lastUsedAt === "string"
      ? new Date(item.lastUsedAt)
      : item.lastUsedAt
    : null;

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="relative aspect-square bg-zinc-900">
        <div className="absolute left-2 top-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectChange(v === true)}
            aria-label={`Select ${item.fileName}`}
          />
        </div>
        {item.type === "MUSIC" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
            <Music className="h-10 w-10" />
            <span className="px-3 text-center text-xs">
              {item.musicMetadata?.title ?? item.fileName}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl ?? item.storageUrl}
            alt={item.fileName}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="space-y-2 p-3">
        <p
          className="truncate text-sm font-medium text-zinc-100"
          title={item.fileName}
        >
          {item.fileName}
        </p>
        <p className="text-xs text-zinc-500">
          Uploaded {format(created, "MMM d, yyyy")}
        </p>
        {item.type !== "MUSIC" ? (
          <p className="text-xs text-zinc-500">
            {item.width && item.height
              ? `${item.width}×${item.height}`
              : "—"}{" "}
            · {formatAspectRatio(item.aspectRatio)}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            {item.musicMetadata
              ? `${Math.round(item.musicMetadata.durationMs / 1000)}s`
              : "—"}
          </p>
        )}
        {item.type === "PHYSIQUE_PHOTO" && item.physiqueMetadata?.year ? (
          <p className="text-xs text-zinc-400">
            Year {item.physiqueMetadata.year}
          </p>
        ) : null}
        {item.type === "THEME_IMAGE" && item.themeMetadata?.description ? (
          <p className="line-clamp-2 text-xs text-zinc-400">
            {item.themeMetadata.description}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {item.mediaTags.slice(0, 6).map((mt) => (
            <Badge key={mt.id}>{mt.tag.name}</Badge>
          ))}
          {item.mediaTags.length > 6 ? (
            <Badge>+{item.mediaTags.length - 6}</Badge>
          ) : null}
        </div>

        <p className="text-xs text-zinc-500">
          Used {item.usageCount}×
          {lastUsed
            ? ` · last ${formatDistanceToNow(lastUsed, { addSuffix: true })}`
            : " · never used"}
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}
