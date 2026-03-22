import { z } from "zod";
import { generateContent, type GenerateRequest } from "../gemini/client.js";
import { type ModelKey } from "../gemini/models.js";
import { imageToBase64, detectMimeType, base64ToBuffer } from "../utils/image.js";
import { FileManager } from "../storage/file-manager.js";

export const generateImageSchema = z.object({
  prompt: z.string().describe("Natural language description OR stringified JSON prompt"),
  prompt_format: z.enum(["text", "json"]).default("text").describe("Whether prompt is plain text or structured JSON"),
  preset: z.string().optional().describe("Preset name (e.g., 'facebook_ad', 'hero_image')"),
  aspect_ratio: z.string().optional().describe("Aspect ratio override (e.g., '16:9', '1:1')"),
  image_size: z.enum(["1K", "2K", "4K"]).optional().describe("Output resolution"),
  model: z.enum(["flash", "pro"]).default("flash").describe("Model: flash (fast) or pro (best quality)"),
  reference_images: z.array(z.string()).optional().describe("File paths to reference images"),
  output_name: z.string().optional().describe("Custom filename without extension"),
  enable_search_grounding: z.boolean().default(false).describe("Use Google Search for real-world accuracy"),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export async function handleGenerateImage(
  input: GenerateImageInput,
  fm: FileManager,
  presets: Record<string, any>
) {
  let aspectRatio = input.aspect_ratio;
  let imageSize = input.image_size;
  let presetApplied: string | undefined;

  if (input.preset) {
    const preset = presets[input.preset];
    if (!preset) {
      return { content: [{ type: "text" as const, text: `Unknown preset: ${input.preset}. Use get_presets to see available presets.` }], isError: true };
    }
    aspectRatio = aspectRatio ?? preset.aspect_ratio;
    imageSize = imageSize ?? preset.recommended_size;
    presetApplied = input.preset;
  }

  let prompt = input.prompt;
  if (input.prompt_format === "json") {
    try {
      JSON.parse(prompt);
    } catch {
      return { content: [{ type: "text" as const, text: "Invalid JSON in prompt. Please provide valid JSON." }], isError: true };
    }
    prompt = `Generate an image based on this JSON description:\n${prompt}`;
  }

  const images: Array<{ base64: string; mimeType: string }> = [];
  if (input.reference_images) {
    for (const refPath of input.reference_images) {
      try {
        const b64 = await imageToBase64(refPath);
        const mime = detectMimeType(refPath);
        images.push({ base64: b64, mimeType: mime });
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Failed to load reference image: ${refPath}. ${err}` }], isError: true };
      }
    }
  }

  const req: GenerateRequest = {
    model: input.model as ModelKey,
    prompt,
    images: images.length > 0 ? images : undefined,
    aspectRatio,
    imageSize,
    enableSearchGrounding: input.enable_search_grounding,
  };

  const result = await generateContent(req);

  if (!result.imageBase64) {
    return { content: [{ type: "text" as const, text: `Image generation failed. Model response: ${result.text ?? "No response"}` }], isError: true };
  }

  const buffer = base64ToBuffer(result.imageBase64);
  const imagePath = await fm.saveImage(buffer, input.output_name);

  await fm.saveMetadata(imagePath, {
    model: input.model,
    prompt: input.prompt.substring(0, 500),
    prompt_format: input.prompt_format,
    preset: presetApplied,
    aspect_ratio: aspectRatio,
    image_size: imageSize,
    created_at: new Date().toISOString(),
  });

  const response = {
    image_path: imagePath,
    model_used: req.model === "flash" ? "gemini-3.1-flash-image-preview" : "gemini-3-pro-image-preview",
    aspect_ratio: aspectRatio ?? "default",
    resolution: imageSize ?? "1K",
    preset_applied: presetApplied ?? "none",
    prompt_used: input.prompt.substring(0, 500),
    description: result.text ?? "",
  };

  return {
    content: [
      { type: "text" as const, text: JSON.stringify(response, null, 2) },
      { type: "resource" as const, resource: { uri: `file://${imagePath}`, mimeType: "image/png" } },
    ],
  };
}
