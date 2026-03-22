import { z } from "zod";
import { generateTextOnly } from "../gemini/client.js";
import { imageToBase64, detectMimeType } from "../utils/image.js";
import { DECOMPOSE_PROMPTS } from "../gemini/prompts.js";
import { FileManager } from "../storage/file-manager.js";

export const decomposeImageSchema = z.object({
  image_path: z.string().describe("Path to the image to decompose"),
  detail_level: z.enum(["basic", "detailed", "exhaustive"]).default("detailed").describe("How granular the JSON breakdown should be"),
});

export type DecomposeImageInput = z.infer<typeof decomposeImageSchema>;

function extractJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  throw new Error("Could not extract valid JSON from model response");
}

export async function handleDecomposeImage(
  input: DecomposeImageInput,
  fm: FileManager
) {
  let b64: string;
  let mime: string;
  try {
    b64 = await imageToBase64(input.image_path);
    mime = detectMimeType(input.image_path);
  } catch (err) {
    return { content: [{ type: "text" as const, text: `Failed to load image: ${input.image_path}. ${err}` }], isError: true };
  }

  const prompt = DECOMPOSE_PROMPTS[input.detail_level];

  const responseText = await generateTextOnly({
    model: "flash",
    prompt,
    images: [{ base64: b64, mimeType: mime }],
  });

  let blueprint: Record<string, unknown>;
  try {
    blueprint = extractJson(responseText);
  } catch (err) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to parse blueprint from model response. Raw response:\n${responseText.substring(0, 1000)}`,
      }],
      isError: true,
    };
  }

  await fm.saveBlueprint(input.image_path, blueprint);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ image_path: input.image_path, blueprint }, null, 2),
    }],
  };
}
