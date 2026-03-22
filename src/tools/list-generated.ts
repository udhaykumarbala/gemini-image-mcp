import { z } from "zod";
import { FileManager } from "../storage/file-manager.js";

export const listGeneratedSchema = z.object({
  filter: z.string().optional().describe("Search term to filter by filename"),
  limit: z.number().default(20).describe("Max results to return"),
  include_blueprints: z.boolean().default(false).describe("Include cached JSON blueprints in results"),
});

export type ListGeneratedInput = z.infer<typeof listGeneratedSchema>;

export async function handleListGenerated(
  input: ListGeneratedInput,
  fm: FileManager
) {
  const images = await fm.listImages(input.filter, input.limit);

  // Build a map of original_image -> edit names for edit_history
  const editMap = new Map<string, string[]>();
  for (const img of images) {
    if (img.hasMetadata) {
      const meta = await fm.loadMetadata(img.path);
      if (meta?.original_image) {
        const origPath = meta.original_image as string;
        if (!editMap.has(origPath)) editMap.set(origPath, []);
        editMap.get(origPath)!.push(img.name);
      }
    }
  }

  const results = [];
  for (const img of images) {
    const entry: Record<string, unknown> = {
      path: img.path,
      name: img.name,
      created_at: img.createdAt.toISOString(),
      size_bytes: img.sizeBytes,
      has_blueprint: img.hasBlueprint,
      edit_history: editMap.get(img.path) ?? [],
    };

    if (img.hasMetadata) {
      const meta = await fm.loadMetadata(img.path);
      if (meta) {
        entry.metadata = meta;
      }
    }

    if (input.include_blueprints && img.hasBlueprint) {
      const bp = await fm.loadBlueprint(img.path);
      if (bp) {
        entry.blueprint = bp;
      }
    }

    results.push(entry);
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ images: results, total: results.length }, null, 2),
    }],
  };
}
