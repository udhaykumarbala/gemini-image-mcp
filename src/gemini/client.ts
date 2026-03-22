import { GoogleGenAI } from "@google/genai";
import { MODELS, type ModelKey } from "./models.js";

export interface GenerateRequest {
  model: ModelKey;
  prompt: string;
  images?: Array<{ base64: string; mimeType: string }>;
  aspectRatio?: string;
  imageSize?: string;
  enableSearchGrounding?: boolean;
}

export interface GenerateResult {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

let client: GoogleGenAI | null = null;

export function initClient(apiKey: string): void {
  client = new GoogleGenAI({ apiKey });
}

function getClient(): GoogleGenAI {
  if (!client) throw new Error("Gemini client not initialized. Call initClient() first.");
  return client;
}

export async function generateContent(req: GenerateRequest): Promise<GenerateResult> {
  const ai = getClient();
  const modelId = MODELS[req.model];

  const parts: Array<Record<string, unknown>> = [];

  if (req.images) {
    for (const img of req.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      });
    }
  }

  parts.push({ text: req.prompt });

  const config: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
  };

  if (req.aspectRatio || req.imageSize) {
    const imageConfig: Record<string, string> = {};
    if (req.aspectRatio) imageConfig.aspectRatio = req.aspectRatio;
    if (req.imageSize) imageConfig.imageSize = req.imageSize;
    config.imageConfig = imageConfig;
  }

  if (req.enableSearchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts }],
    config,
  });

  const result: GenerateResult = {};
  const responseParts = response.candidates?.[0]?.content?.parts ?? [];

  for (const part of responseParts) {
    if ((part as any).text && !(part as any).thought) {
      result.text = (result.text ?? "") + (part as any).text;
    }
    if ((part as any).inlineData) {
      result.imageBase64 = (part as any).inlineData.data;
      result.imageMimeType = (part as any).inlineData.mimeType;
    }
  }

  return result;
}

export async function generateTextOnly(req: {
  model: ModelKey;
  prompt: string;
  images?: Array<{ base64: string; mimeType: string }>;
}): Promise<string> {
  const ai = getClient();
  const modelId = MODELS[req.model];

  const parts: Array<Record<string, unknown>> = [];
  if (req.images) {
    for (const img of req.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      });
    }
  }
  parts.push({ text: req.prompt });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["TEXT"] },
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text && !p.thought)
    .map((p: any) => p.text)
    .join("") ?? "";

  return text;
}
