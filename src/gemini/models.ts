export const MODELS = {
  flash: "gemini-3.1-flash-image-preview",
  pro: "gemini-3-pro-image-preview",
} as const;

export type ModelKey = keyof typeof MODELS;

export const DEFAULT_GENERATION_CONFIG = {
  flash: {
    responseModalities: ["TEXT", "IMAGE"] as const,
  },
  pro: {
    responseModalities: ["TEXT", "IMAGE"] as const,
  },
};
