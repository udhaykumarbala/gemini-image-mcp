import { z } from "zod";

export const getPresetsSchema = z.object({
  category: z.enum(["ad", "web", "social", "print", "all"]).default("all").describe("Filter presets by category"),
});

export type GetPresetsInput = z.infer<typeof getPresetsSchema>;

export function handleGetPresets(
  input: GetPresetsInput,
  presets: Array<Record<string, unknown>>
) {
  const filtered = input.category === "all"
    ? presets
    : presets.filter((p) => p.category === input.category);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ presets: filtered, total: filtered.length }, null, 2),
    }],
  };
}
