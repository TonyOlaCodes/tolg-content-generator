import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatAspectRatio(ratio: number | null | undefined): string {
  if (!ratio || !Number.isFinite(ratio)) return "—";
  const common: [number, string][] = [
    [1, "1:1"],
    [4 / 5, "4:5"],
    [3 / 4, "3:4"],
    [2 / 3, "2:3"],
    [9 / 16, "9:16"],
    [16 / 9, "16:9"],
    [3 / 2, "3:2"],
    [4 / 3, "4:3"],
  ];
  for (const [value, label] of common) {
    if (Math.abs(ratio - value) < 0.03) return label;
  }
  return ratio.toFixed(2);
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function computeAspectRatio(width: number, height: number): number {
  if (!width || !height) return 1;
  return width / height;
}

export function detectOrientation(
  width: number,
  height: number,
): "PORTRAIT" | "LANDSCAPE" | "SQUARE" {
  if (width === height) return "SQUARE";
  return width > height ? "LANDSCAPE" : "PORTRAIT";
}

export function formatDraftName(draftNumber: number): string {
  return `post_${String(draftNumber).padStart(3, "0")}`;
}

export const FIXED_HASHTAGS = "#Gym #Fyp #TOLG";
