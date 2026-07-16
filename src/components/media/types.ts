export type MediaTagRef = {
  id: string;
  tagId: string;
  source: string;
  tag: {
    id: string;
    name: string;
    slug: string;
    category: string;
    isSystem: boolean;
  };
};

export type MediaAssetItem = {
  id: string;
  type: "THEME_IMAGE" | "PHYSIQUE_PHOTO" | "MUSIC";
  fileName: string;
  originalFileName: string;
  mimeType: string;
  storageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  usageCount: number;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  physiqueMetadata: { year: number | null } | null;
  themeMetadata: {
    description: string | null;
    contentStyles: string[];
    progressionConcepts: string[];
  } | null;
  musicMetadata: { title: string; durationMs: number } | null;
  mediaTags: MediaTagRef[];
};

export type TagOption = {
  id: string;
  name: string;
  slug: string;
  category: string;
  isSystem: boolean;
};
