export type AppSettingsMap = {
  // Generation
  "generation.defaultDraftCount": number;
  "generation.aiEnabled": boolean;
  "generation.defaultTone": string;
  "generation.matchingStrictness": number;
  "generation.repeatAvoidanceStrength": number;
  "generation.defaultPhysiquePhotoCount": number;
  "generation.allowVariablePhotoCount": boolean;
  "generation.aspectRatioBiasPercent": number;

  // Text
  "text.font": string;
  "text.fontSize": number;
  "text.fontWeight": number;
  "text.position": string;
  "text.alignment": string;
  "text.outlineThickness": number;
  "text.safeMargin": number;
  "text.readingSpeedPerWord": number;
  "text.minReadingDuration": number;
  "text.maxReadingDuration": number;

  // Instagram Reel
  "reel.physiquePhotoDuration": number;
  "reel.cutTransitionPercent": number;
  "reel.fadeTransitionPercent": number;
  "reel.fadeDuration": number;
  "reel.musicVolume": number;
  "reel.videoQuality": string;
  "reel.frameRate": number;
  "reel.resolutionWidth": number;
  "reel.resolutionHeight": number;

  // TikTok
  "tiktok.carouselImageQuality": number;
  "tiktok.canvasWidth": number;
  "tiktok.canvasHeight": number;
  "tiktok.autoCopyCaption": boolean;
  "tiktok.packageSeparately": boolean;

  // Export
  "export.defaultDestination": string;
  "export.fileNaming": string;
  "export.keepMetadata": boolean;
  "export.keepSourceReferences": boolean;
};

export const DEFAULT_SETTINGS: AppSettingsMap = {
  "generation.defaultDraftCount": 5,
  "generation.aiEnabled": false,
  "generation.defaultTone": "progression",
  "generation.matchingStrictness": 0.7,
  "generation.repeatAvoidanceStrength": 0.6,
  "generation.defaultPhysiquePhotoCount": 2,
  "generation.allowVariablePhotoCount": true,
  "generation.aspectRatioBiasPercent": 10,

  "text.font": "Inter",
  "text.fontSize": 48,
  "text.fontWeight": 700,
  "text.position": "TOP",
  "text.alignment": "CENTER",
  "text.outlineThickness": 2,
  "text.safeMargin": 64,
  "text.readingSpeedPerWord": 0.35,
  "text.minReadingDuration": 2.5,
  "text.maxReadingDuration": 6,

  "reel.physiquePhotoDuration": 1.8,
  "reel.cutTransitionPercent": 65,
  "reel.fadeTransitionPercent": 35,
  "reel.fadeDuration": 0.25,
  "reel.musicVolume": 0.85,
  "reel.videoQuality": "high",
  "reel.frameRate": 30,
  "reel.resolutionWidth": 1080,
  "reel.resolutionHeight": 1920,

  "tiktok.carouselImageQuality": 90,
  "tiktok.canvasWidth": 1080,
  "tiktok.canvasHeight": 1920,
  "tiktok.autoCopyCaption": true,
  "tiktok.packageSeparately": true,

  "export.defaultDestination": "exports",
  "export.fileNaming": "numbered",
  "export.keepMetadata": true,
  "export.keepSourceReferences": true,
};

export const SETTING_GROUPS: Record<
  string,
  { label: string; keys: (keyof AppSettingsMap)[] }
> = {
  generation: {
    label: "Generation settings",
    keys: [
      "generation.defaultDraftCount",
      "generation.aiEnabled",
      "generation.defaultTone",
      "generation.matchingStrictness",
      "generation.repeatAvoidanceStrength",
      "generation.defaultPhysiquePhotoCount",
      "generation.allowVariablePhotoCount",
    ],
  },
  text: {
    label: "Text settings",
    keys: [
      "text.font",
      "text.fontSize",
      "text.fontWeight",
      "text.position",
      "text.alignment",
      "text.outlineThickness",
      "text.safeMargin",
      "text.readingSpeedPerWord",
      "text.minReadingDuration",
      "text.maxReadingDuration",
    ],
  },
  reel: {
    label: "Instagram Reel settings",
    keys: [
      "reel.physiquePhotoDuration",
      "reel.cutTransitionPercent",
      "reel.fadeTransitionPercent",
      "reel.fadeDuration",
      "reel.musicVolume",
      "reel.videoQuality",
      "reel.frameRate",
      "reel.resolutionWidth",
      "reel.resolutionHeight",
    ],
  },
  tiktok: {
    label: "TikTok settings",
    keys: [
      "tiktok.carouselImageQuality",
      "tiktok.canvasWidth",
      "tiktok.canvasHeight",
      "tiktok.autoCopyCaption",
      "tiktok.packageSeparately",
    ],
  },
  export: {
    label: "Export settings",
    keys: [
      "export.defaultDestination",
      "export.fileNaming",
      "export.keepMetadata",
      "export.keepSourceReferences",
    ],
  },
};
