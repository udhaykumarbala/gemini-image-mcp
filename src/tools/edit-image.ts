import { z } from "zod";
import { generateContent, type GenerateRequest } from "../gemini/client.js";
import { type ModelKey } from "../gemini/models.js";
import { imageToBase64, detectMimeType, base64ToBuffer } from "../utils/image.js";
import { applyChanges, listChangedPaths } from "../utils/merge.js";
import { buildEditJsonPrompt, buildEditNlPrompt } from "../gemini/prompts.js";
import { FileManager } from "../storage/file-manager.js";

export const editImageSchema = z.object({
  image_path: z.string().describe("Path to the image to edit"),
  edit_type: z.enum(["json", "natural_language"]).describe("How the edit is described"),
  changes: z.record(z.string(), z.unknown()).optional().describe("JSON object with dot-notation paths to change (for json edit_type)"),
  instruction: z.string().optional().describe("Natural language edit instruction (for natural_language edit_type)"),
  blueprint: z.record(z.string(), z.unknown()).optional().describe("Full JSON blueprint. If omitted, uses cached blueprint."),
  preserve_style: z.boolean().default(true).describe("Instruct model to keep unchanged elements identical"),
  model: z.enum(["flash", "pro"]).default("flash").describe("Model to use"),
  output_name: z.string().optional().describe("Custom filename for edited image"),
});

export type EditImageInput = z.infer<typeof editImageSchema>;

export async function handleEditImage(
  input: EditImageInput,
  fm: FileManager
) {
  if (input.edit_type === "json" && !input.changes) {
    return { content: [{ type: "text" as const, text: "edit_type is 'json' but no 'changes' provided." }], isError: true };
  }
  if (input.edit_type === "natural_language" && !input.instruction) {
    return { content: [{ type: "text" as const, text: "edit_type is 'natural_language' but no 'instruction' provided." }], isError: true };
  }

  let b64: string;
  let mime: string;
  try {
    b64 = await imageToBase64(input.image_path);
    mime = detectMimeType(input.image_path);
  } catch (err) {
    return { content: [{ type: "text" as const, text: `Failed to load image: ${input.image_path}. ${err}` }], isError: true };
  }

  let prompt: string;
  let changesApplied: string[] = [];

  if (input.edit_type === "json") {
    const blueprint = input.blueprint ?? await fm.loadBlueprint(input.image_path);
    if (!blueprint) {
      return {
        content: [{
          type: "text" as const,
          text: "No blueprint found. Run decompose_image first, or provide a blueprint parameter.",
        }],
        isError: true,
      };
    }

    const changes = input.changes!;
    changesApplied = listChangedPaths(changes);
    const mergedBlueprint = applyChanges(blueprint, changes);
    prompt = buildEditJsonPrompt(mergedBlueprint, changesApplied);
  } else {
    const blueprint = input.blueprint ?? await fm.loadBlueprint(input.image_path);
    prompt = buildEditNlPrompt(input.instruction!, blueprint);
  }

  const req: GenerateRequest = {
    model: input.model as ModelKey,
    prompt,
    images: [{ base64: b64, mimeType: mime }],
  };

  const result = await generateContent(req);

  if (!result.imageBase64) {
    return {
      content: [{
        type: "text" as const,
        text: `Edit failed. Model response: ${result.text ?? "No response"}`,
      }],
      isError: true,
    };
  }

  const editName = input.output_name ?? fm.nextEditName(input.image_path);
  const buffer = base64ToBuffer(result.imageBase64);
  const editedPath = await fm.saveImage(buffer, editName);

  await fm.saveMetadata(editedPath, {
    original_image: input.image_path,
    edit_type: input.edit_type,
    changes: input.changes ?? null,
    instruction: input.instruction ?? null,
    model: input.model,
    created_at: new Date().toISOString(),
  });

  if (input.edit_type === "json" && input.changes) {
    const blueprint = input.blueprint ?? await fm.loadBlueprint(input.image_path);
    if (blueprint) {
      const updated = applyChanges(blueprint, input.changes);
      await fm.saveBlueprint(editedPath, updated);
    }
  }

  const response = {
    original_path: input.image_path,
    edited_path: editedPath,
    edit_type: input.edit_type,
    changes_applied: changesApplied.length > 0 ? changesApplied : undefined,
    model_used: input.model === "flash" ? "gemini-3.1-flash-image-preview" : "gemini-3-pro-image-preview",
    description: result.text ?? "",
  };

  return {
    content: [
      { type: "text" as const, text: JSON.stringify(response, null, 2) },
      { type: "resource" as const, resource: { uri: `file://${editedPath}`, mimeType: "image/png", text: editedPath } },
    ],
  };
}
