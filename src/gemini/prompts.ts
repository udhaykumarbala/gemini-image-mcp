export const DECOMPOSE_PROMPTS = {
  basic: `Analyze this image and describe it as a JSON object with these top-level fields ONLY:
- "subject": array of objects with {id, type, description, position}
- "scene": {location, time, lighting: {type, direction}}
- "composition": {framing, angle}
- "meta": {aspect_ratio}

Return ONLY valid JSON, no markdown fences, no explanation.`,

  detailed: `Analyze this image and describe EVERY visual detail as a JSON object. Use this exact structure:

{
  "subject": [{ "id": string, "type": "person"|"object"|"animal", "description": string, "hair": {"style": string, "color": string}, "expression": string, "clothing": [{"item": string, "color": string (use hex like #2C3E50), "fabric": string, "fit": string}], "accessories": [{"item": string, "material": string, "color": string, "location": string}], "position": string, "pose": string }],
  "scene": { "location": string, "time": string, "weather": string, "lighting": {"type": string, "direction": string}, "background_elements": string[] },
  "text_rendering": { "enabled": boolean, "text_content": string, "placement": string, "font_style": string, "color": string },
  "technical": { "lens": string, "aperture": string, "film_stock": string },
  "composition": { "framing": string, "angle": string, "focus_point": string },
  "style_modifiers": { "medium": string, "aesthetic": string[] },
  "meta": { "aspect_ratio": string, "quality": string }
}

Use hex color codes (e.g., #2C3E50) instead of color names for precision.
Return ONLY valid JSON, no markdown fences, no explanation.`,

  exhaustive: `Analyze this image with EXTREME precision and describe every visual detail as a JSON object. Include ALL of these fields:

{
  "subject": [{ "id": string, "type": "person"|"animal"|"object"|"vehicle", "description": string (detailed physical description), "name": string|null, "age": string, "gender": string, "hair": {"style": string (specific cut name), "color": string (hex code)}, "expression": string, "clothing": [{"item": string, "color": string (hex), "fabric": string, "pattern": string, "fit": string, "layer": string}], "accessories": [{"item": string, "material": string, "color": string (hex), "location": string}], "position": string, "pose": string (detailed action description) }],
  "scene": { "location": string (detailed description), "time": string, "weather": string, "lighting": {"type": string, "direction": string}, "background_elements": string[] },
  "text_rendering": { "enabled": boolean, "text_content": string, "placement": string, "font_style": string, "color": string (hex) },
  "technical": { "camera_model": string, "lens": string, "aperture": string, "shutter_speed": string, "iso": string, "film_stock": string },
  "composition": { "framing": string, "angle": string, "focus_point": string },
  "style_modifiers": { "medium": string, "aesthetic": string[], "artist_reference": string[] },
  "meta": { "aspect_ratio": string, "quality": string, "seed": null }
}

Be extremely precise:
- Use hex color codes (#RRGGBB) for ALL colors
- Describe exact camera settings you estimate were used
- Name specific clothing items, fabrics, and patterns
- Describe precise body positions and gestures

Return ONLY valid JSON, no markdown fences, no explanation.`,
};

export function buildEditJsonPrompt(
  mergedBlueprint: Record<string, unknown>,
  changedPaths: string[]
): string {
  const changedList = changedPaths.map((p) => `- ${p}`).join("\n");
  return `Here is the COMPLETE description of the TARGET image after edits:

${JSON.stringify(mergedBlueprint, null, 2)}

Edit the provided image to match this description. Change ONLY the following fields:
${changedList}

CRITICAL INSTRUCTIONS:
- Keep EVERYTHING else EXACTLY as it is in the original image
- Do NOT change any element not listed above
- Use the exact colors, positions, and styles specified in the target description
- Preserve the original image's composition, lighting, and style for unchanged elements`;
}

export function buildEditNlPrompt(
  instruction: string,
  blueprint?: Record<string, unknown> | null
): string {
  if (blueprint) {
    return `Current image description:
${JSON.stringify(blueprint, null, 2)}

Edit instruction: ${instruction}

CRITICAL: Preserve ALL elements not mentioned in the edit instruction. Keep the same style, lighting, composition, and all unchanged subjects EXACTLY as they are.`;
  }
  return `${instruction}

CRITICAL: Keep everything else in the image EXACTLY the same. ONLY change what is explicitly described above.`;
}
