"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TagOption } from "@/components/media/types";

type TagPickerProps = {
  tags: TagOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  categories?: string[];
  allowCustom?: boolean;
  customTags?: string[];
  onCustomTagsChange?: (tags: string[]) => void;
  className?: string;
  label?: string;
};

export function TagPicker({
  tags,
  selectedIds,
  onChange,
  categories,
  allowCustom = false,
  customTags = [],
  onCustomTagsChange,
  className,
  label = "Tags",
}: TagPickerProps) {
  const [customInput, setCustomInput] = useState("");
  const [filter, setFilter] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = tags;
    if (categories?.length) {
      list = list.filter((t) => categories.includes(t.category));
    }
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tags, categories, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, TagOption[]>();
    for (const tag of filtered) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  // Auto-open first category / keep search results expanded
  const effectiveOpen =
    filter.trim().length > 0
      ? null // show all matches when searching
      : openCategory ?? grouped[0]?.[0] ?? null;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name || !onCustomTagsChange) return;
    if (customTags.includes(name)) {
      setCustomInput("");
      return;
    }
    onCustomTagsChange([...customTags, name]);
    setCustomInput("");
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tags…"
          className="h-8 max-w-[180px]"
        />
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        {grouped.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500">No tags match.</p>
        ) : (
          grouped.map(([category, items]) => {
            const isOpen =
              filter.trim().length > 0 || effectiveOpen === category;
            const selectedInGroup = items.filter((t) =>
              selectedIds.includes(t.id),
            ).length;

            return (
              <div
                key={category}
                className="rounded-md border border-zinc-800/80"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  onClick={() =>
                    setOpenCategory((prev) =>
                      prev === category ? null : category,
                    )
                  }
                >
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    {category.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {selectedInGroup > 0 ? `${selectedInGroup} selected · ` : ""}
                    {isOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {isOpen ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 px-3 py-2">
                    {items.map((tag) => {
                      const active = selectedIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggle(tag.id)}
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs transition-colors",
                            active
                              ? "border-white bg-white text-black"
                              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500",
                          )}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const tag = tags.find((t) => t.id === id);
            if (!tag) return null;
            return (
              <Badge key={id} className="gap-1">
                {tag.name}
                <button
                  type="button"
                  className="ml-1 text-zinc-400 hover:text-white"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${tag.name}`}
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      {allowCustom && onCustomTagsChange ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Add custom tag"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addCustom}>
              Add
            </Button>
          </div>
          {customTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {customTags.map((name) => (
                <Badge key={name} variant="warning" className="gap-1">
                  {name}
                  <button
                    type="button"
                    className="ml-1"
                    onClick={() =>
                      onCustomTagsChange(customTags.filter((t) => t !== name))
                    }
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
