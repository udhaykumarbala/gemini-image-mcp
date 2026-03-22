# Nano Banana MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that wraps Google's Nano Banana (Gemini image generation) API with 5 tools for creating, editing, and managing visual assets.

**Architecture:** TypeScript MCP server using `@modelcontextprotocol/sdk` with stdio transport. Gemini API via `@google/genai` SDK. 5 tools (generate, decompose, edit, presets, list) + 1 MCP prompt + 1 MCP resource. Local filesystem storage with `.blueprint.json` and `.meta.json` companion files.

**Tech Stack:** TypeScript 5.x, Node.js 22+, `@modelcontextprotocol/sdk` ^1.x, `@google/genai` ^1.x, `zod` ^3.25+, `vitest` ^3.x

**Spec:** `plan.md` (root)

---

## File Structure

```
img-mcp/
├── src/
│   ├── index.ts                      # Entry point: env validation, stdio transport, server start
│   ├── server.ts                     # McpServer creation, register all tools/prompts/resources
│   ├── tools/
│   │   ├── generate-image.ts         # generate_image tool handler
│   │   ├── decompose-image.ts        # decompose_image tool handler
│   │   ├── edit-image.ts             # edit_image tool handler
│   │   ├── get-presets.ts            # get_presets tool handler
│   │   └── list-generated.ts         # list_generated tool handler
│   ├── gemini/
│   │   ├── client.ts                 # GoogleGenAI client wrapper (init, generateContent, extractImage)
│   │   ├── models.ts                 # Model ID constants + default configs
│   │   └── prompts.ts               # All system prompts (decompose, edit templates)
│   ├── schema/
│   │   └── nano-banana.schema.json   # Full JSON prompt schema
│   ├── presets/
│   │   └── presets.json              # All asset presets data
│   ├── storage/
│   │   └── file-manager.ts           # Save/load images, blueprints, metadata, list images
│   └── utils/
│       ├── image.ts                  # Base64 encode/decode, MIME detection
│       └── merge.ts                  # Dot-notation path resolution + deep merge
├── prompts/
│   └── nano-banana-expert.md         # MCP prompt content
├── tests/
│   ├── merge.test.ts                 # Unit tests for dot-notation merge
│   ├── image-utils.test.ts           # Unit tests for image utilities
│   └── file-manager.test.ts          # Unit tests for storage layer
├── output/                           # Default output dir (gitignored)
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── plan.md                           # Design spec
```

**Intentionally simplified from spec:**
- `src/schema/validator.ts` — dropped. JSON prompt validation is done via `JSON.parse()` in the tool handler. Full schema validation adds complexity without clear value (Gemini handles invalid fields gracefully).
- `src/storage/manifest.ts` — dropped. Edit history tracking is handled via `.meta.json` companion files with `original_image` field, scanned at query time by `list_generated`.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd "/Users/udhaykumar/Hobby apps/img-mcp"
npm init -y
npm install @modelcontextprotocol/sdk @google/genai zod dotenv
npm install -D typescript tsx @types/node vitest
```

- [ ] **Step 2: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Configure package.json scripts and type**

Update `package.json` to add:
```json
{
  "type": "module",
  "bin": {
    "nanobanana-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create .env.example**

```
GEMINI_API_KEY=your-google-ai-studio-api-key
OUTPUT_DIR=./output
DEFAULT_MODEL=flash
DEFAULT_IMAGE_SIZE=1K
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
output/
.env
*.blueprint.json
*.meta.json
```

- [ ] **Step 6: Create placeholder entry point**

Create `src/index.ts`:
```typescript
#!/usr/bin/env node
console.log("nanobanana-mcp server starting...");
```

- [ ] **Step 7: Verify build works**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git init
git add package.json tsconfig.json .env.example .gitignore src/index.ts plan.md
git commit -m "chore: scaffold nanobanana-mcp project with TypeScript and dependencies"
```

---

### Task 2: Utility — Image Helpers

**Files:**
- Create: `src/utils/image.ts`
- Create: `tests/image-utils.test.ts`

- [ ] **Step 1: Write failing tests for image utilities**

Create `tests/image-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { detectMimeType, base64ToBuffer, bufferToBase64 } from "../src/utils/image.js";

describe("detectMimeType", () => {
  it("returns image/png for .png files", () => {
    expect(detectMimeType("/path/to/image.png")).toBe("image/png");
  });

  it("returns image/jpeg for .jpg files", () => {
    expect(detectMimeType("/path/to/photo.jpg")).toBe("image/jpeg");
  });

  it("returns image/jpeg for .jpeg files", () => {
    expect(detectMimeType("/path/to/photo.jpeg")).toBe("image/jpeg");
  });

  it("returns image/webp for .webp files", () => {
    expect(detectMimeType("/path/to/image.webp")).toBe("image/webp");
  });

  it("throws for unsupported formats", () => {
    expect(() => detectMimeType("/path/to/file.bmp")).toThrow("Unsupported image format");
  });
});

describe("base64 round-trip", () => {
  it("converts buffer to base64 and back", () => {
    const original = Buffer.from("test image data");
    const b64 = bufferToBase64(original);
    const restored = base64ToBuffer(b64);
    expect(restored).toEqual(original);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/image-utils.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement image utilities**

Create `src/utils/image.ts`:
```typescript
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function detectMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) {
    throw new Error(`Unsupported image format: ${ext}`);
  }
  return mime;
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

export async function imageToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return bufferToBase64(buffer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/image-utils.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/image.ts tests/image-utils.test.ts
git commit -m "feat: add image utility functions (mime detection, base64 conversion)"
```

---

### Task 3: Utility — JSON Blueprint Merge

**Files:**
- Create: `src/utils/merge.ts`
- Create: `tests/merge.test.ts`

- [ ] **Step 1: Write failing tests for merge utilities**

Create `tests/merge.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getByPath, setByPath, applyChanges, listChangedPaths } from "../src/utils/merge.js";

describe("getByPath", () => {
  const obj = {
    subject: [
      { hair: { color: "black", style: "pixie_cut" }, clothing: [{ color: "blue" }] }
    ],
    scene: { lighting: { type: "natural" } },
  };

  it("resolves simple dot path", () => {
    expect(getByPath(obj, "scene.lighting.type")).toBe("natural");
  });

  it("resolves array index path", () => {
    expect(getByPath(obj, "subject[0].hair.color")).toBe("black");
  });

  it("resolves nested array index", () => {
    expect(getByPath(obj, "subject[0].clothing[0].color")).toBe("blue");
  });

  it("returns undefined for non-existent path", () => {
    expect(getByPath(obj, "subject[0].age")).toBeUndefined();
  });
});

describe("setByPath", () => {
  it("sets a nested value", () => {
    const obj = { scene: { lighting: { type: "natural" } } };
    setByPath(obj, "scene.lighting.type", "neon_lights");
    expect(obj.scene.lighting.type).toBe("neon_lights");
  });

  it("sets a value in an array element", () => {
    const obj = { subject: [{ hair: { color: "black" } }] };
    setByPath(obj, "subject[0].hair.color", "blonde");
    expect(obj.subject[0].hair.color).toBe("blonde");
  });

  it("creates intermediate objects if needed", () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, "scene.lighting.type", "neon");
    expect((obj as any).scene.lighting.type).toBe("neon");
  });
});

describe("applyChanges", () => {
  it("merges multiple changes into a blueprint", () => {
    const blueprint = {
      subject: [{ hair: { color: "black", style: "pixie_cut" }, expression: "neutral" }],
      scene: { location: "office", lighting: { type: "natural" } },
    };
    const changes = {
      "subject[0].hair.color": "platinum_blonde",
      "scene.lighting.type": "neon_lights",
    };
    const result = applyChanges(blueprint, changes);
    expect(result.subject[0].hair.color).toBe("platinum_blonde");
    expect(result.subject[0].hair.style).toBe("pixie_cut"); // unchanged
    expect(result.scene.lighting.type).toBe("neon_lights");
    expect(result.scene.location).toBe("office"); // unchanged
  });

  it("does not mutate the original blueprint", () => {
    const blueprint = { scene: { location: "office" } };
    const changes = { "scene.location": "beach" };
    const result = applyChanges(blueprint, changes);
    expect(result.scene.location).toBe("beach");
    expect(blueprint.scene.location).toBe("office");
  });
});

describe("listChangedPaths", () => {
  it("returns the list of changed dot-notation paths", () => {
    const changes = {
      "subject[0].hair.color": "blonde",
      "scene.lighting.type": "neon",
    };
    expect(listChangedPaths(changes)).toEqual([
      "subject[0].hair.color",
      "scene.lighting.type",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/merge.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement merge utilities**

Create `src/utils/merge.ts`:
```typescript
/**
 * Dot-notation path utilities for JSON blueprint manipulation.
 * Supports paths like: "subject[0].hair.color", "scene.lighting.type"
 */

type PathSegment = string | number;

function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const parts = path.split(".");
  for (const part of parts) {
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      segments.push(match[1], parseInt(match[2], 10));
    } else {
      segments.push(part);
    }
  }
  return segments;
}

export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current;
}

export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = parsePath(path);
  let current: Record<string | number, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (current[seg] === undefined || current[seg] === null) {
      current[seg] = typeof nextSeg === "number" ? [] : {};
    }
    current = current[seg] as Record<string | number, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

export function applyChanges(
  blueprint: Record<string, unknown>,
  changes: Record<string, unknown>
): Record<string, unknown> {
  const result = structuredClone(blueprint);
  for (const [path, value] of Object.entries(changes)) {
    setByPath(result, path, value);
  }
  return result;
}

export function listChangedPaths(changes: Record<string, unknown>): string[] {
  return Object.keys(changes);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/merge.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/merge.ts tests/merge.test.ts
git commit -m "feat: add dot-notation JSON merge utilities for blueprint editing"
```

---

### Task 4: Storage — File Manager

**Files:**
- Create: `src/storage/file-manager.ts`
- Create: `tests/file-manager.test.ts`

- [ ] **Step 1: Write failing tests for file manager**

Create `tests/file-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileManager } from "../src/storage/file-manager.js";

let testDir: string;
let fm: FileManager;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "nanobanana-test-"));
  fm = new FileManager(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("FileManager", () => {
  it("saves and loads an image", async () => {
    const data = Buffer.from("fake-png-data");
    const path = await fm.saveImage(data, "test-img");
    expect(path).toBe(join(testDir, "test-img.png"));
    const loaded = await fm.loadImageBuffer(path);
    expect(loaded).toEqual(data);
  });

  it("auto-generates name when none provided", async () => {
    const data = Buffer.from("fake-png-data");
    const path = await fm.saveImage(data);
    expect(path).toMatch(/\.png$/);
  });

  it("saves and loads blueprint", async () => {
    const data = Buffer.from("fake");
    const imgPath = await fm.saveImage(data, "bp-test");
    const blueprint = { scene: { location: "office" } };
    await fm.saveBlueprint(imgPath, blueprint);
    const loaded = await fm.loadBlueprint(imgPath);
    expect(loaded).toEqual(blueprint);
  });

  it("returns null for missing blueprint", async () => {
    const loaded = await fm.loadBlueprint("/nonexistent/image.png");
    expect(loaded).toBeNull();
  });

  it("saves and loads metadata", async () => {
    const data = Buffer.from("fake");
    const imgPath = await fm.saveImage(data, "meta-test");
    const meta = { model: "flash", prompt: "test" };
    await fm.saveMetadata(imgPath, meta);
    const loaded = await fm.loadMetadata(imgPath);
    expect(loaded).toEqual(meta);
  });

  it("lists images in directory", async () => {
    await fm.saveImage(Buffer.from("a"), "img-a");
    await fm.saveImage(Buffer.from("b"), "img-b");
    const list = await fm.listImages();
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.name).sort()).toEqual(["img-a.png", "img-b.png"]);
  });

  it("filters images by name", async () => {
    await fm.saveImage(Buffer.from("a"), "hero-shot");
    await fm.saveImage(Buffer.from("b"), "ad-banner");
    const list = await fm.listImages("hero");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("hero-shot.png");
  });

  it("generates unique edit name", () => {
    expect(fm.nextEditName("/output/hero.png")).toBe("hero-edit-1");
    expect(fm.nextEditName("/output/hero-edit-1.png")).toBe("hero-edit-2");
    expect(fm.nextEditName("/output/hero-edit-5.png")).toBe("hero-edit-6");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/file-manager.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement file manager**

Create `src/storage/file-manager.ts`:
```typescript
import { readFile, writeFile, readdir, stat, mkdir, access } from "node:fs/promises";
import { join, basename, dirname, extname } from "node:path";

export interface ImageEntry {
  name: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
  hasBlueprint: boolean;
  hasMetadata: boolean;
}

export class FileManager {
  constructor(private outputDir: string) {}

  async ensureDir(): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
  }

  async saveImage(data: Buffer, name?: string): Promise<string> {
    await this.ensureDir();
    const filename = name ?? `image-${Date.now()}`;
    const filePath = join(this.outputDir, `${filename}.png`);
    await writeFile(filePath, data);
    return filePath;
  }

  async loadImageBuffer(filePath: string): Promise<Buffer> {
    return readFile(filePath);
  }

  private blueprintPath(imagePath: string): string {
    const dir = dirname(imagePath);
    const name = basename(imagePath, extname(imagePath));
    return join(dir, `${name}.blueprint.json`);
  }

  private metadataPath(imagePath: string): string {
    const dir = dirname(imagePath);
    const name = basename(imagePath, extname(imagePath));
    return join(dir, `${name}.meta.json`);
  }

  async saveBlueprint(imagePath: string, blueprint: Record<string, unknown>): Promise<void> {
    const path = this.blueprintPath(imagePath);
    await writeFile(path, JSON.stringify(blueprint, null, 2));
  }

  async loadBlueprint(imagePath: string): Promise<Record<string, unknown> | null> {
    const path = this.blueprintPath(imagePath);
    try {
      await access(path);
      const data = await readFile(path, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveMetadata(imagePath: string, meta: Record<string, unknown>): Promise<void> {
    const path = this.metadataPath(imagePath);
    await writeFile(path, JSON.stringify(meta, null, 2));
  }

  async loadMetadata(imagePath: string): Promise<Record<string, unknown> | null> {
    const path = this.metadataPath(imagePath);
    try {
      await access(path);
      const data = await readFile(path, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async listImages(filter?: string, limit = 20): Promise<ImageEntry[]> {
    await this.ensureDir();
    const files = await readdir(this.outputDir);
    const pngFiles = files.filter((f) => f.endsWith(".png"));

    const entries: ImageEntry[] = [];
    for (const file of pngFiles) {
      if (filter && !file.toLowerCase().includes(filter.toLowerCase())) continue;
      const filePath = join(this.outputDir, file);
      const fileStat = await stat(filePath);
      const bp = this.blueprintPath(filePath);
      const mp = this.metadataPath(filePath);
      let hasBlueprint = false;
      let hasMetadata = false;
      try { await access(bp); hasBlueprint = true; } catch {}
      try { await access(mp); hasMetadata = true; } catch {}

      entries.push({
        name: file,
        path: filePath,
        createdAt: fileStat.birthtime,
        sizeBytes: fileStat.size,
        hasBlueprint,
        hasMetadata,
      });
      if (entries.length >= limit) break;
    }
    return entries;
  }

  nextEditName(imagePath: string): string {
    const name = basename(imagePath, extname(imagePath));
    const editMatch = name.match(/^(.+)-edit-(\d+)$/);
    if (editMatch) {
      return `${editMatch[1]}-edit-${parseInt(editMatch[2], 10) + 1}`;
    }
    return `${name}-edit-1`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/file-manager.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/file-manager.ts tests/file-manager.test.ts
git commit -m "feat: add file manager for images, blueprints, and metadata storage"
```

---

### Task 5: Gemini Client Layer

**Files:**
- Create: `src/gemini/models.ts`
- Create: `src/gemini/prompts.ts`
- Create: `src/gemini/client.ts`

- [ ] **Step 1: Create model constants**

Create `src/gemini/models.ts`:
```typescript
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
```

- [ ] **Step 2: Create system prompts for decomposition and editing**

Create `src/gemini/prompts.ts`:
```typescript
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
```

- [ ] **Step 3: Create Gemini client wrapper**

Create `src/gemini/client.ts`:
```typescript
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

  // Add images first if provided
  if (req.images) {
    for (const img of req.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      });
    }
  }

  // Add text prompt
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

  // Extract text and image from response
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
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/gemini/models.ts src/gemini/prompts.ts src/gemini/client.ts
git commit -m "feat: add Gemini client wrapper with image generation and text-only modes"
```

---

### Task 6: JSON Schema & Presets Data

**Files:**
- Create: `src/schema/nano-banana.schema.json`
- Create: `src/presets/presets.json`

- [ ] **Step 1: Create the Nano Banana JSON prompt schema**

Create `src/schema/nano-banana.schema.json` — the full schema with all enums for subject, scene, technical, composition, text_rendering, style_modifiers, and meta fields. This is a large JSON file (~400 lines). Include all enum values from the research (hair styles, clothing fabrics, lighting types, camera models, lens focal lengths, film stocks, expressions, positions, framing options, angles, font styles, aesthetic options, etc.).

Key sections:
- `meta`: aspect_ratio (14 values), quality (9 values), seed, guidance_scale
- `subject[]`: type (8 values), hair.style (60+ values), hair.color (30+ values), expression (12 values), position (9 values), clothing (item, color, fabric 21 values, pattern 12 values, fit 8 values, layer 5 values), accessories (material 26 values, location 10 values)
- `scene`: time (8 values), weather (9 values), lighting.type (10 values), lighting.direction (7 values)
- `technical`: camera_model (8 values), lens (10 values), aperture (9 values), shutter_speed (11 values), iso (8 values), film_stock (10 values)
- `composition`: framing (8 values), angle (9 values), focus_point (6 values)
- `text_rendering`: placement (9 values), font_style (8 values)
- `style_modifiers`: medium (11 values), aesthetic (16 values)

- [ ] **Step 2: Create presets data file**

Create `src/presets/presets.json` with all 10 presets from the spec:
- Ad: facebook_ad (1:1, 1080x1080), instagram_story_ad (9:16, 1080x1920), google_display_banner (16:9, 1200x628)
- Web: hero_image (21:9, 2560x1080), og_image (16:9, 1200x630), product_card (4:5, 800x1000), email_header (3:1, 600x200)
- Social: linkedin_post (1:1, 1080x1080), twitter_post (16:9, 1200x675), youtube_thumbnail (16:9, 1280x720)

Each preset has: name, category, display_name, aspect_ratio, recommended_size, dimensions_px, tips[], best_for.

**IMPORTANT:** `presets.json` must be a bare JSON array at the top level (not wrapped in `{ "presets": [...] }`). The server code parses it directly as `Array<Record<string, unknown>>`.

- [ ] **Step 3: Verify JSON files are valid**

Run: `node --input-type=module -e "import{readFileSync}from'fs';JSON.parse(readFileSync('src/schema/nano-banana.schema.json','utf8'));console.log('Schema OK')"`
Run: `node --input-type=module -e "import{readFileSync}from'fs';JSON.parse(readFileSync('src/presets/presets.json','utf8'));console.log('Presets OK')"`
Expected: Both print OK

- [ ] **Step 4: Commit**

```bash
git add src/schema/nano-banana.schema.json src/presets/presets.json
git commit -m "feat: add Nano Banana JSON schema and asset presets data"
```

---

### Task 7: MCP Prompt Content

**Files:**
- Create: `prompts/nano-banana-expert.md`

- [ ] **Step 1: Write the MCP prompt content**

Create `prompts/nano-banana-expert.md` with the full expert guide from the spec. This includes:
- JSON Schema Reference (all top-level fields with key enums)
- Editing Best Practices (when JSON vs NL, prompt patterns, hex colors)
- Asset Creation Guidelines (ad creatives, web assets, brand consistency)
- Workflow Patterns (create new, edit existing, brand series)

- [ ] **Step 2: Commit**

```bash
git add prompts/nano-banana-expert.md
git commit -m "feat: add nano_banana_expert MCP prompt content"
```

---

### Task 8: Tool — generate_image

**Files:**
- Create: `src/tools/generate-image.ts`

- [ ] **Step 1: Implement generate_image tool handler**

Create `src/tools/generate-image.ts`:
```typescript
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
  // Resolve preset defaults
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

  // Build prompt
  let prompt = input.prompt;
  if (input.prompt_format === "json") {
    try {
      JSON.parse(prompt);
    } catch {
      return { content: [{ type: "text" as const, text: "Invalid JSON in prompt. Please provide valid JSON." }], isError: true };
    }
    prompt = `Generate an image based on this JSON description:\n${prompt}`;
  }

  // Load reference images
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

  // Generate
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

  // Save image
  const buffer = base64ToBuffer(result.imageBase64);
  const imagePath = await fm.saveImage(buffer, input.output_name);

  // Save metadata
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/generate-image.ts
git commit -m "feat: implement generate_image tool with preset support and reference images"
```

---

### Task 9: Tool — decompose_image

**Files:**
- Create: `src/tools/decompose-image.ts`

- [ ] **Step 1: Implement decompose_image tool handler**

Create `src/tools/decompose-image.ts`:
```typescript
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
  // Try parsing directly first
  try {
    return JSON.parse(text);
  } catch {}

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  // Try finding first { to last }
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
  // Load and encode image
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

  // Cache blueprint
  await fm.saveBlueprint(input.image_path, blueprint);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ image_path: input.image_path, blueprint }, null, 2),
    }],
  };
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/decompose-image.ts
git commit -m "feat: implement decompose_image tool with JSON extraction and blueprint caching"
```

---

### Task 10: Tool — edit_image

**Files:**
- Create: `src/tools/edit-image.ts`

- [ ] **Step 1: Implement edit_image tool handler**

Create `src/tools/edit-image.ts`:
```typescript
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
  changes: z.record(z.unknown()).optional().describe("JSON object with dot-notation paths to change (for json edit_type)"),
  instruction: z.string().optional().describe("Natural language edit instruction (for natural_language edit_type)"),
  blueprint: z.record(z.unknown()).optional().describe("Full JSON blueprint. If omitted, uses cached blueprint."),
  preserve_style: z.boolean().default(true).describe("Instruct model to keep unchanged elements identical"),
  model: z.enum(["flash", "pro"]).default("flash").describe("Model to use"),
  output_name: z.string().optional().describe("Custom filename for edited image"),
});

export type EditImageInput = z.infer<typeof editImageSchema>;

export async function handleEditImage(
  input: EditImageInput,
  fm: FileManager
) {
  // Validate edit_type-specific params
  if (input.edit_type === "json" && !input.changes) {
    return { content: [{ type: "text" as const, text: "edit_type is 'json' but no 'changes' provided." }], isError: true };
  }
  if (input.edit_type === "natural_language" && !input.instruction) {
    return { content: [{ type: "text" as const, text: "edit_type is 'natural_language' but no 'instruction' provided." }], isError: true };
  }

  // Load image
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
    // JSON edit path
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

    // We'll update the cached blueprint after successful edit
  } else {
    // Natural language edit path
    const blueprint = input.blueprint ?? await fm.loadBlueprint(input.image_path);
    prompt = buildEditNlPrompt(input.instruction!, blueprint);
  }

  // Send to Gemini
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

  // Save edited image
  const editName = input.output_name ?? fm.nextEditName(input.image_path);
  const buffer = base64ToBuffer(result.imageBase64);
  const editedPath = await fm.saveImage(buffer, editName);

  // Save metadata
  await fm.saveMetadata(editedPath, {
    original_image: input.image_path,
    edit_type: input.edit_type,
    changes: input.changes ?? null,
    instruction: input.instruction ?? null,
    model: input.model,
    created_at: new Date().toISOString(),
  });

  // Update blueprint cache for JSON edits
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
      { type: "resource" as const, resource: { uri: `file://${editedPath}`, mimeType: "image/png" } },
    ],
  };
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/edit-image.ts
git commit -m "feat: implement edit_image tool with JSON diff and natural language edit paths"
```

---

### Task 11: Tool — get_presets

**Files:**
- Create: `src/tools/get-presets.ts`

- [ ] **Step 1: Implement get_presets tool handler**

Create `src/tools/get-presets.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/get-presets.ts
git commit -m "feat: implement get_presets tool with category filtering"
```

---

### Task 12: Tool — list_generated

**Files:**
- Create: `src/tools/list-generated.ts`

- [ ] **Step 1: Implement list_generated tool handler**

Create `src/tools/list-generated.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/list-generated.ts
git commit -m "feat: implement list_generated tool with metadata and blueprint support"
```

---

### Task 13: MCP Server — Wire Everything Together

**Files:**
- Create: `src/server.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create server.ts with all tool/prompt/resource registrations**

Create `src/server.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generateImageSchema, handleGenerateImage } from "./tools/generate-image.js";
import { decomposeImageSchema, handleDecomposeImage } from "./tools/decompose-image.js";
import { editImageSchema, handleEditImage } from "./tools/edit-image.js";
import { getPresetsSchema, handleGetPresets } from "./tools/get-presets.js";
import { listGeneratedSchema, handleListGenerated } from "./tools/list-generated.js";
import { FileManager } from "./storage/file-manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createServer(outputDir: string) {
  const server = new McpServer({
    name: "nanobanana",
    version: "1.0.0",
  });

  const fm = new FileManager(outputDir);
  await fm.ensureDir();

  // Load presets
  const presetsPath = join(__dirname, "presets", "presets.json");
  const presetsData: Array<Record<string, unknown>> = JSON.parse(
    await readFile(presetsPath, "utf-8")
  );
  const presetsMap: Record<string, Record<string, unknown>> = {};
  for (const p of presetsData) {
    presetsMap[p.name as string] = p;
  }

  // Load schema for resource
  const schemaPath = join(__dirname, "schema", "nano-banana.schema.json");
  const schemaContent = await readFile(schemaPath, "utf-8");

  // Load prompt content
  const promptPath = join(__dirname, "..", "prompts", "nano-banana-expert.md");
  const promptContent = await readFile(promptPath, "utf-8");

  // --- Register Tools ---

  server.registerTool("generate_image", {
    title: "Generate Image",
    description: "Create a new image from text prompt, JSON prompt, or both. Supports presets for common asset types (ads, web, social).",
    inputSchema: generateImageSchema,
  }, async (input) => {
    return handleGenerateImage(input, fm, presetsMap);
  });

  server.registerTool("decompose_image", {
    title: "Decompose Image",
    description: "Analyze an image and return a structured JSON blueprint of all visual components. Use this as the first step before editing an image with JSON changes.",
    inputSchema: decomposeImageSchema,
  }, async (input) => {
    return handleDecomposeImage(input, fm);
  });

  server.registerTool("edit_image", {
    title: "Edit Image",
    description: "Edit an existing image using structured JSON changes (dot-notation paths) or natural language instructions. For JSON edits, run decompose_image first to get the blueprint.",
    inputSchema: editImageSchema,
  }, async (input) => {
    return handleEditImage(input, fm);
  });

  server.registerTool("get_presets", {
    title: "Get Presets",
    description: "List available asset presets with dimensions, tips, and conventions for ads, web pages, and social media.",
    inputSchema: getPresetsSchema,
  }, async (input) => {
    return handleGetPresets(input, presetsData);
  });

  server.registerTool("list_generated", {
    title: "List Generated Images",
    description: "Browse and search previously generated images in the output directory, with optional metadata and blueprints.",
    inputSchema: listGeneratedSchema,
  }, async (input) => {
    return handleListGenerated(input, fm);
  });

  // --- Register Prompt ---

  server.registerPrompt("nano_banana_expert", {
    title: "Nano Banana Expert",
    description: "Comprehensive guide for creating and editing images with Nano Banana. Includes JSON schema reference, editing best practices, asset creation guidelines, and workflow patterns.",
  }, () => ({
    messages: [{
      role: "user" as const,
      content: { type: "text" as const, text: promptContent },
    }],
  }));

  // --- Register Resource ---

  server.registerResource("json_schema", "nanobanana://schema/prompt", {
    title: "Nano Banana JSON Prompt Schema",
    description: "Complete JSON schema for structured image generation prompts with all enum values for subjects, scenes, camera settings, and styles.",
    mimeType: "application/json",
  }, async (uri) => ({
    contents: [{ uri: uri.href, text: schemaContent }],
  }));

  return server;
}
```

- [ ] **Step 2: Update index.ts as the entry point**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { initClient } from "./gemini/client.js";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const outputDir = process.env.OUTPUT_DIR ?? "./output";

  initClient(apiKey);

  const server = await createServer(outputDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat: wire MCP server with all 5 tools, prompt, and resource registrations"
```

---

### Task 14: Build & Verify

**Files:**
- Modify: `package.json` (if needed)

- [ ] **Step 1: Run full TypeScript build**

Run: `npx tsc`
Expected: `dist/` directory created with compiled JS files, no errors

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (merge, image-utils, file-manager)

- [ ] **Step 3: Verify server starts without crashing**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | GEMINI_API_KEY=test-key node dist/index.js`
Expected: JSON-RPC response with server capabilities (tools, prompts, resources listed)

- [ ] **Step 4: Commit build output configuration**

```bash
git add -A
git commit -m "feat: complete nanobanana MCP server build — all tools, prompts, resources ready"
```

---

### Task 15: Documentation & Integration Config

**Files:**
- Create: `api_test.html`
- Create: `uiflow.md`
- Create: `swagger.yaml`

- [ ] **Step 1: Create swagger.yaml**

Create an OpenAPI 3.0 spec documenting all 5 MCP tools as conceptual endpoints. Each tool maps to a POST endpoint with its input schema as the request body and its return format as the response schema. This serves as a machine-readable reference for the MCP tool API.

- [ ] **Step 2: Create api_test.html**

Create a simple HTML page documenting all 5 tools with their parameters, example requests/responses, and a test workflow walkthrough. Include:
- Tool: generate_image — all params, example with preset
- Tool: decompose_image — params, example response
- Tool: edit_image — JSON edit example, NL edit example
- Tool: get_presets — category filter example
- Tool: list_generated — filter example

- [ ] **Step 3: Create uiflow.md**

Create `uiflow.md` documenting the user workflow:
- Flow 1: Generate new asset → `get_presets` → `generate_image`
- Flow 2: Edit existing asset → `decompose_image` → `edit_image` (JSON)
- Flow 3: Quick edit → `edit_image` (natural language)
- Flow 4: Brand series → `generate_image` with reference_images → repeat
- Flow 5: Browse history → `list_generated`

- [ ] **Step 4: Commit**

```bash
git add api_test.html uiflow.md swagger.yaml
git commit -m "docs: add api_test.html, uiflow.md, and swagger.yaml for tool documentation"
```

---

### Task 16: Error Handling Polish

**Files:**
- Modify: `src/gemini/client.ts`
- Modify: `src/tools/generate-image.ts`
- Modify: `src/tools/edit-image.ts`
- Modify: `src/tools/decompose-image.ts`

- [ ] **Step 1: Add retry logic to Gemini client**

Add to `src/gemini/client.ts` a wrapper that retries on rate limit errors (HTTP 429) with exponential backoff, max 3 attempts, 1s/2s/4s delays.

- [ ] **Step 2: Add safety block handling**

In each tool handler, catch Gemini safety block errors and return a user-friendly message suggesting to rephrase the prompt.

- [ ] **Step 3: Add file size warning**

In `generate-image.ts` and `edit-image.ts`, check if input image > 20MB and return a warning suggesting resize.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/gemini/client.ts src/tools/generate-image.ts src/tools/edit-image.ts src/tools/decompose-image.ts
git commit -m "fix: add retry logic, safety block handling, and file size warnings"
```

---

## Summary

| Task | Description | Files | Estimated Steps |
|------|-------------|-------|-----------------|
| 1 | Project scaffolding | 5 files | 8 |
| 2 | Image utilities | 2 files | 5 |
| 3 | JSON merge utilities | 2 files | 5 |
| 4 | File manager | 2 files | 5 |
| 5 | Gemini client layer | 3 files | 5 |
| 6 | JSON schema & presets | 2 files | 4 |
| 7 | MCP prompt content | 1 file | 2 |
| 8 | generate_image tool | 1 file | 3 |
| 9 | decompose_image tool | 1 file | 3 |
| 10 | edit_image tool | 1 file | 3 |
| 11 | get_presets tool | 1 file | 2 |
| 12 | list_generated tool | 1 file | 2 |
| 13 | MCP server wiring | 2 files | 4 |
| 14 | Build & verify | 0 files | 4 |
| 15 | Documentation | 3 files | 4 |
| 16 | Error handling | 4 files | 5 |
| **Total** | | **30 files** | **65 steps** |
