-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('THEME_IMAGE', 'PHYSIQUE_PHOTO', 'MUSIC');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('PORTRAIT', 'LANDSCAPE', 'SQUARE');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('TIME', 'PHASE', 'QUALITY', 'PHYSIQUE', 'POSE', 'ANGLE', 'LOCATION', 'EXPRESSION', 'THEME_MOOD', 'THEME_STYLE', 'THEME_CONCEPT', 'MUSIC_MOOD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('GENERATED', 'EDITING', 'APPROVED', 'REJECTED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExportPlatform" AS ENUM ('TIKTOK_CAROUSEL', 'INSTAGRAM_REEL', 'APPROVED_BUNDLE');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('OPENAI', 'TIKTOK', 'CLOUDINARY', 'RENDER_WORKER');

-- CreateEnum
CREATE TYPE "TextPosition" AS ENUM ('TOP', 'UPPER_MIDDLE', 'CENTER', 'LOWER_MIDDLE', 'BOTTOM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TextAlignment" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
    "storagePublicId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "contentHash" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysiquePhotoMetadata" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "orientation" "Orientation",
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysiquePhotoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeImageMetadata" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "description" TEXT,
    "contentStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progressionConcepts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeImageMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicMetadata" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaTag" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'GENERATED',
    "generationMode" "GenerationMode" NOT NULL,
    "hookText" TEXT NOT NULL,
    "socialCaption" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL DEFAULT '#Gym #Fyp #TOLG',
    "textPosition" "TextPosition" NOT NULL DEFAULT 'TOP',
    "textAlignment" "TextAlignment" NOT NULL DEFAULT 'CENTER',
    "textSize" INTEGER NOT NULL DEFAULT 48,
    "outlineThickness" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "customTextX" DOUBLE PRECISION,
    "customTextY" DOUBLE PRECISION,
    "showHookOnPhysique" BOOLEAN NOT NULL DEFAULT false,
    "selectedSongId" TEXT,
    "aiGenerationData" JSONB,
    "hiddenSelectionRules" JSONB,
    "selectedTagsSnapshot" JSONB,
    "tiktokExportStatus" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "instagramExportStatus" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftMediaItem" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'physique',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftMediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookTemplate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hookText" TEXT NOT NULL,
    "themeMoodTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredPhotoCount" INTEGER NOT NULL DEFAULT 2,
    "photoRules" JSONB NOT NULL,
    "photoOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredMatching" JSONB,
    "captionStyle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedHook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT,
    "hookTemplateId" TEXT,
    "hookText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedHook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionRule" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "photoIndex" INTEGER NOT NULL,
    "requiredTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearNear" INTEGER,
    "yearTolerance" INTEGER,
    "preferPoseMatch" BOOLEAN NOT NULL DEFAULT false,
    "preferBodyPartMatch" BOOLEAN NOT NULL DEFAULT false,
    "preferYearGap" BOOLEAN NOT NULL DEFAULT false,
    "rawRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoPairHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoAId" TEXT NOT NULL,
    "photoBId" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoPairHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT,
    "mediaAssetId" TEXT,
    "platform" "ExportPlatform" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "outputPath" TEXT,
    "outputUrl" TEXT,
    "caption" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'QUEUED',
    "workerTarget" TEXT NOT NULL DEFAULT 'local',
    "renderSettings" JSONB,
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "group" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "configPublic" JSONB,
    "secretsEncrypted" TEXT,
    "statusMessage" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_type_deletedAt_idx" ON "MediaAsset"("userId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_createdAt_idx" ON "MediaAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_usageCount_idx" ON "MediaAsset"("usageCount");

-- CreateIndex
CREATE INDEX "MediaAsset_lastUsedAt_idx" ON "MediaAsset"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_userId_contentHash_key" ON "MediaAsset"("userId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PhysiquePhotoMetadata_mediaAssetId_key" ON "PhysiquePhotoMetadata"("mediaAssetId");

-- CreateIndex
CREATE INDEX "PhysiquePhotoMetadata_year_idx" ON "PhysiquePhotoMetadata"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeImageMetadata_mediaAssetId_key" ON "ThemeImageMetadata"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicMetadata_mediaAssetId_key" ON "MusicMetadata"("mediaAssetId");

-- CreateIndex
CREATE INDEX "MusicMetadata_durationMs_idx" ON "MusicMetadata"("durationMs");

-- CreateIndex
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_category_key" ON "Tag"("slug", "category");

-- CreateIndex
CREATE INDEX "MediaTag_tagId_idx" ON "MediaTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaTag_mediaAssetId_tagId_key" ON "MediaTag"("mediaAssetId", "tagId");

-- CreateIndex
CREATE INDEX "Draft_userId_status_idx" ON "Draft"("userId", "status");

-- CreateIndex
CREATE INDEX "Draft_userId_createdAt_idx" ON "Draft"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_userId_draftNumber_key" ON "Draft"("userId", "draftNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_userId_name_key" ON "Draft"("userId", "name");

-- CreateIndex
CREATE INDEX "DraftMediaItem_mediaAssetId_idx" ON "DraftMediaItem"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftMediaItem_draftId_position_key" ON "DraftMediaItem"("draftId", "position");

-- CreateIndex
CREATE INDEX "HookTemplate_category_isActive_idx" ON "HookTemplate"("category", "isActive");

-- CreateIndex
CREATE INDEX "GeneratedHook_userId_createdAt_idx" ON "GeneratedHook"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedHook_draftId_idx" ON "GeneratedHook"("draftId");

-- CreateIndex
CREATE INDEX "SelectionRule_draftId_idx" ON "SelectionRule"("draftId");

-- CreateIndex
CREATE INDEX "PhotoPairHistory_userId_lastUsedAt_idx" ON "PhotoPairHistory"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoPairHistory_userId_photoAId_photoBId_key" ON "PhotoPairHistory"("userId", "photoAId", "photoBId");

-- CreateIndex
CREATE INDEX "ExportRecord_userId_createdAt_idx" ON "ExportRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportRecord_draftId_platform_idx" ON "ExportRecord"("draftId", "platform");

-- CreateIndex
CREATE INDEX "ExportRecord_status_idx" ON "ExportRecord"("status");

-- CreateIndex
CREATE INDEX "RenderJob_userId_status_idx" ON "RenderJob"("userId", "status");

-- CreateIndex
CREATE INDEX "RenderJob_draftId_idx" ON "RenderJob"("draftId");

-- CreateIndex
CREATE INDEX "RenderJob_status_createdAt_idx" ON "RenderJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AppSetting_userId_group_idx" ON "AppSetting"("userId", "group");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_userId_key_key" ON "AppSetting"("userId", "key");

-- CreateIndex
CREATE INDEX "ExternalConnection_provider_idx" ON "ExternalConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalConnection_userId_provider_key" ON "ExternalConnection"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysiquePhotoMetadata" ADD CONSTRAINT "PhysiquePhotoMetadata_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeImageMetadata" ADD CONSTRAINT "ThemeImageMetadata_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicMetadata" ADD CONSTRAINT "MusicMetadata_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTag" ADD CONSTRAINT "MediaTag_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTag" ADD CONSTRAINT "MediaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftMediaItem" ADD CONSTRAINT "DraftMediaItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftMediaItem" ADD CONSTRAINT "DraftMediaItem_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedHook" ADD CONSTRAINT "GeneratedHook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedHook" ADD CONSTRAINT "GeneratedHook_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedHook" ADD CONSTRAINT "GeneratedHook_hookTemplateId_fkey" FOREIGN KEY ("hookTemplateId") REFERENCES "HookTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionRule" ADD CONSTRAINT "SelectionRule_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoPairHistory" ADD CONSTRAINT "PhotoPairHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoPairHistory" ADD CONSTRAINT "PhotoPairHistory_photoAId_fkey" FOREIGN KEY ("photoAId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoPairHistory" ADD CONSTRAINT "PhotoPairHistory_photoBId_fkey" FOREIGN KEY ("photoBId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
