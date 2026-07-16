"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { MediaCard } from "@/components/media/media-card";
import { MediaEditPanel } from "@/components/media/media-edit-panel";
import { TagPicker } from "@/components/media/tag-picker";
import type { MediaAssetItem, TagOption } from "@/components/media/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  bulkDeleteAction,
  bulkTagAction,
  listMediaAction,
} from "@/server/actions/media";

type MediaType = "THEME_IMAGE" | "PHYSIQUE_PHOTO" | "MUSIC";
type SortOption = "newest" | "oldest" | "name" | "usage" | "lastUsed";

type MediaLibraryProps = {
  initialTags: TagOption[];
};

type ListState = {
  items: MediaAssetItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const EMPTY_LIST: ListState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 24,
  totalPages: 1,
};

export function MediaLibrary({ initialTags }: MediaLibraryProps) {
  const [type, setType] = useState<MediaType>("THEME_IMAGE");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListState>(EMPTY_LIST);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaAssetItem | null>(null);
  const [bulkAddTagIds, setBulkAddTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await listMediaAction({
          type,
          search,
          tags: filterTagIds,
          sort,
          page,
          pageSize: 24,
        });
        setList({
          items: result.items as unknown as MediaAssetItem[],
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        });
        setSelected(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load media");
      }
    });
  }, [type, search, filterTagIds, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleTabChange(value: string) {
    setType(value as MediaType);
    setPage(1);
    setFilterTagIds([]);
    setSearch("");
    setSearchInput("");
    setEditing(null);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAllOnPage(checked: boolean) {
    if (checked) {
      setSelected(new Set(list.items.map((i) => i.id)));
    } else {
      setSelected(new Set());
    }
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selected.size} item(s)? This cannot be undone.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const result = await bulkDeleteAction({
          mediaIds: [...selected],
        });
        setMessage(`Deleted ${result.deleted} item(s).`);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk delete failed");
      }
    });
  }

  function handleBulkTag() {
    if (selected.size === 0 || bulkAddTagIds.length === 0) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const result = await bulkTagAction({
          mediaIds: [...selected],
          addTagIds: bulkAddTagIds,
          removeTagIds: [],
        });
        setMessage(`Updated tags on ${result.updated} item(s).`);
        setBulkAddTagIds([]);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk tag failed");
      }
    });
  }

  function handleDeleteOne(id: string) {
    const confirmed = window.confirm("Delete this media item?");
    if (!confirmed) return;
    startTransition(async () => {
      setError(null);
      try {
        await bulkDeleteAction({ mediaIds: [id] });
        if (editing?.id === id) setEditing(null);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  const allSelected =
    list.items.length > 0 && list.items.every((i) => selected.has(i.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Media Library
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse, tag, and manage theme images, physique photos, and music.
        </p>
      </div>

      <Tabs value={type} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="THEME_IMAGE">Theme Images</TabsTrigger>
          <TabsTrigger value="PHYSIQUE_PHOTO">Physique Photos</TabsTrigger>
          <TabsTrigger value="MUSIC">Music</TabsTrigger>
        </TabsList>

        <TabsContent value={type} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label htmlFor="media-search">Search</Label>
              <div className="flex gap-2">
                <Input
                  id="media-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="File name, title, description…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchInput);
                      setPage(1);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSearch(searchInput);
                    setPage(1);
                  }}
                >
                  Search
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="media-sort">Sort</Label>
              <select
                id="media-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
                className="flex h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
                <option value="usage">Most used</option>
                <option value="lastUsed">Last used</option>
              </select>
            </div>
          </div>

          <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <summary className="cursor-pointer text-sm text-zinc-300">
              Tag filter
              {filterTagIds.length > 0
                ? ` (${filterTagIds.length} selected)`
                : ""}
            </summary>
            <div className="mt-3">
              <TagPicker
                tags={initialTags}
                selectedIds={filterTagIds}
                onChange={(ids) => {
                  setFilterTagIds(ids);
                  setPage(1);
                }}
                label="Filter by tags (match all)"
              />
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => selectAllOnPage(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600"
              />
              Select page ({selected.size} selected)
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={selected.size === 0 || bulkAddTagIds.length === 0 || pending}
              title={
                selected.size === 0
                  ? "Select items first"
                  : bulkAddTagIds.length === 0
                    ? "Choose tags to add"
                    : undefined
              }
              onClick={handleBulkTag}
            >
              Bulk add tags
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={selected.size === 0 || pending}
              title={
                selected.size === 0 ? "Select items first" : undefined
              }
              onClick={handleBulkDelete}
            >
              Bulk delete
            </Button>
            {pending ? (
              <span className="text-xs text-zinc-500">Working…</span>
            ) : null}
          </div>

          {selected.size > 0 ? (
            <details className="rounded-lg border border-zinc-800 p-3" open>
              <summary className="cursor-pointer text-sm text-zinc-300">
                Bulk tag editor
              </summary>
              <div className="mt-3">
                <TagPicker
                  tags={initialTags}
                  selectedIds={bulkAddTagIds}
                  onChange={setBulkAddTagIds}
                  label="Tags to add to selected"
                />
              </div>
            </details>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {message}
            </p>
          ) : null}

          {list.items.length === 0 && !pending ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
              <p className="text-sm text-zinc-400">No media found for this filter.</p>
              <Button asChild variant="outline" className="mt-4" size="sm">
                <Link href="/upload">Upload media</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelectChange={(checked) => toggleSelect(item.id, checked)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => handleDeleteOne(item.id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-zinc-500">
              {list.total} item{list.total === 1 ? "" : "s"} · page {list.page}{" "}
              of {list.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1 || pending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= list.totalPages || pending}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {editing ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60"
            aria-label="Close edit panel"
            onClick={() => setEditing(null)}
          />
          <MediaEditPanel
            item={editing}
            tags={initialTags}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
