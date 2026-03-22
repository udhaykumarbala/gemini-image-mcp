# Nano Banana MCP — Design & Implementation Plan

## Overview

An MCP (Model Context Protocol) server that wraps Google's Nano Banana (Gemini image generation) API to enable AI assistants like Claude to create, edit, and manage visual assets for web pages, ad creatives, and brand materials — all from Claude Code.

**Architecture**: Smart Core — lean tools + rich MCP prompts + data-driven presets
**Runtime**: TypeScript / Node.js
**API Backend**: Google Generative AI (`@google/genai` SDK)
**Models**: Gemini 3.1 Flash Image (`gemini-3.1-flash-image-preview`), Gemini 3 Pro Image (`gemini-3-pro-image-preview`)

---

## Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Use cases | All — ads, web assets, brand series | Equal priority |
| Decompose strategy | On-demand, only when editing | Not all images need editing; saves API calls |
| Scope / opinionation | Hybrid — raw tools + smart prompts | Flexibility without tool explosion |
| Storage | Local filesystem, return paths | Simple, works offline |
| Edit format | Claude decides (JSON diff or NL) | Max flexibility per edit complexity |
| Language | TypeScript | Best MCP SDK + ecosystem support |

---

## Tools (5)

### 1. `generate_image`

Creates a new image from text prompt, JSON prompt, or both.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Natural language description OR stringified JSON prompt |
| `prompt_format` | `"text"` \| `"json"` | No (default: `"text"`) | Whether prompt is plain text or structured JSON |
| `preset` | string | No | Preset name (e.g., `"facebook_ad"`, `"hero_image"`, `"og_image"`) — applies dimensions + conventions |
| `aspect_ratio` | string | No | Override: `"1:1"`, `"16:9"`, `"9:16"`, `"4:3"`, `"21:9"`, etc. |
| `image_size` | `"512"` \| `"1K"` \| `"2K"` \| `"4K"` | No (default: `"1K"`) | Output resolution |
| `model` | `"flash"` \| `"pro"` | No (default: `"flash"`) | `flash` = Gemini 3.1 Flash (fast/cheap), `pro` = Gemini 3 Pro (best quality) |
| `reference_images` | string[] | No | File paths to reference images for character/object consistency |
| `output_name` | string | No | Custom filename (without extension). Auto-generated if omitted |
| `enable_search_grounding` | boolean | No (default: false) | Use Google Search for real-world accuracy |

**Returns:**
```json
{
  "image_path": "/output/my-image.png",
  "model_used": "gemini-3.1-flash-image-preview",
  "aspect_ratio": "16:9",
  "resolution": "1K",
  "preset_applied": "facebook_ad",
  "prompt_used": "..."
}
```

**Behavior:**
- If `preset` is provided, merges preset's `aspect_ratio` and `image_size` (params override preset)
- If `prompt_format` is `"json"`, validates against the Nano Banana JSON schema before sending
- Reference images are loaded from disk, base64-encoded, and sent inline
- Output saved to `{OUTPUT_DIR}/{output_name}.png`

---

### 2. `decompose_image`

Analyzes an existing image and returns a structured JSON blueprint describing every visual component. This is the **first step** of the edit workflow.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `image_path` | string | Yes | Path to the image to decompose |
| `detail_level` | `"basic"` \| `"detailed"` \| `"exhaustive"` | No (default: `"detailed"`) | How granular the JSON breakdown should be |

**Returns:**
```json
{
  "image_path": "/output/hero.png",
  "blueprint": {
    "subject": [
      {
        "id": "person_1",
        "type": "person",
        "description": "Young woman with short black hair",
        "hair": { "style": "pixie_cut", "color": "jet_black" },
        "expression": "smiling",
        "clothing": [
          { "item": "blazer", "color": "#2C3E50", "fabric": "wool", "fit": "slim" }
        ],
        "position": "center",
        "pose": "standing, arms crossed"
      }
    ],
    "scene": {
      "location": "modern office with glass walls",
      "time": "golden_hour",
      "lighting": { "type": "natural_sunlight", "direction": "side_lit" },
      "background_elements": ["potted plants", "whiteboard with diagrams"]
    },
    "text_rendering": {
      "enabled": false
    },
    "technical": {
      "lens": "50mm",
      "aperture": "f/2.8",
      "film_stock": "Fujifilm Pro 400H"
    },
    "composition": {
      "framing": "medium_shot",
      "angle": "eye_level",
      "focus_point": "face"
    },
    "style_modifiers": {
      "medium": "photography",
      "aesthetic": ["minimalist"]
    },
    "meta": {
      "aspect_ratio": "16:9",
      "quality": "ultra_photorealistic"
    }
  }
}
```

**Behavior:**
- Sends the image to Gemini with a system prompt instructing it to output a JSON description following our schema
- `detail_level` controls the prompt:
  - `"basic"` — subject, scene, composition only (~10 fields)
  - `"detailed"` — all major sections (~30 fields)
  - `"exhaustive"` — every field including camera, film stock, hex colors, accessories (~60+ fields)
- The blueprint is also cached alongside the image as `{image_name}.blueprint.json` for future edits

---

### 3. `edit_image`

Edits an existing image using either structured JSON changes or natural language instructions. Claude decides which approach to use based on edit complexity.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `image_path` | string | Yes | Path to the image to edit |
| `edit_type` | `"json"` \| `"natural_language"` | Yes | How the edit is described |
| `changes` | object | Required if `edit_type` = `"json"` | JSON object with only the fields to change, using dot-notation paths |
| `instruction` | string | Required if `edit_type` = `"natural_language"` | Natural language edit instruction |
| `blueprint` | object | No | Full JSON blueprint (from `decompose_image`). If omitted, checks for cached `.blueprint.json` |
| `preserve_style` | boolean | No (default: true) | Explicitly instruct model to keep unchanged elements identical |
| `model` | `"flash"` \| `"pro"` | No (default: `"flash"`) | Model to use for the edit |
| `output_name` | string | No | Custom filename for the edited image |

**Example — JSON edit (change hair color + add sunglasses):**
```json
{
  "image_path": "/output/hero.png",
  "edit_type": "json",
  "changes": {
    "subject[0].hair.color": "platinum_blonde",
    "subject[0].accessories": [
      { "item": "sunglasses", "material": "metal", "color": "gold", "location": "face" }
    ]
  }
}
```

**Example — Natural language edit:**
```json
{
  "image_path": "/output/hero.png",
  "edit_type": "natural_language",
  "instruction": "Change the background to a tropical beach at sunset. Keep the person exactly the same."
}
```

**Behavior:**

For **JSON edits** (`edit_type: "json"`):
1. Load the original image
2. Load or retrieve the blueprint (from cache or `blueprint` param)
3. Merge `changes` into the full blueprint to produce the "target" JSON
4. Build a prompt: `"Here is the complete description of the target image: {merged_json}. Edit the provided image to match this description. Change ONLY: {list of changed fields}. Keep everything else EXACTLY as it is in the original image."`
5. Send image + prompt to Gemini
6. Save result, update cached blueprint

For **natural language edits** (`edit_type: "natural_language"`):
1. Load the original image
2. If blueprint exists, include it as context: `"Current image description: {blueprint}. Edit instruction: {instruction}. Preserve all elements not mentioned in the instruction."`
3. If no blueprint, send image + instruction directly
4. Save result

**Returns:**
```json
{
  "original_path": "/output/hero.png",
  "edited_path": "/output/hero-edit-1.png",
  "edit_type": "json",
  "changes_applied": ["subject[0].hair.color", "subject[0].accessories"],
  "model_used": "gemini-3.1-flash-image-preview"
}
```

---

### 4. `get_presets`

Returns all available asset presets with their dimensions, conventions, and tips.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | `"ad"` \| `"web"` \| `"social"` \| `"print"` \| `"all"` | No (default: `"all"`) | Filter presets by category |

**Returns:**
```json
{
  "presets": [
    {
      "name": "facebook_ad",
      "category": "ad",
      "display_name": "Facebook Ad Creative",
      "aspect_ratio": "1:1",
      "recommended_size": "1K",
      "dimensions_px": "1080x1080",
      "tips": [
        "Keep text under 20% of image area",
        "Use bright, contrasting colors",
        "Place key message in the top third"
      ],
      "best_for": "Facebook/Instagram feed ads"
    },
    {
      "name": "instagram_story_ad",
      "category": "ad",
      "display_name": "Instagram Story Ad",
      "aspect_ratio": "9:16",
      "recommended_size": "2K",
      "dimensions_px": "1080x1920",
      "tips": [
        "Keep safe zone 250px from top and bottom",
        "Bold text, minimal detail — users swipe fast"
      ],
      "best_for": "Instagram/Facebook story ads"
    },
    {
      "name": "google_display_banner",
      "category": "ad",
      "display_name": "Google Display Banner",
      "aspect_ratio": "16:9",
      "recommended_size": "1K",
      "dimensions_px": "1200x628",
      "tips": [
        "Clear CTA area on the right third",
        "Avoid small text — often shown at reduced size"
      ],
      "best_for": "Google Display Network responsive ads"
    },
    {
      "name": "hero_image",
      "category": "web",
      "display_name": "Website Hero Image",
      "aspect_ratio": "21:9",
      "recommended_size": "2K",
      "dimensions_px": "2560x1080",
      "tips": [
        "Leave space for text overlay (left or center)",
        "Ensure subject works with both light and dark text",
        "Consider gradient overlay compatibility"
      ],
      "best_for": "Above-the-fold hero sections"
    },
    {
      "name": "og_image",
      "category": "web",
      "display_name": "Open Graph / Social Share Image",
      "aspect_ratio": "16:9",
      "recommended_size": "1K",
      "dimensions_px": "1200x630",
      "tips": [
        "Title text must be legible at thumbnail size",
        "Brand logo in corner"
      ],
      "best_for": "Link previews on social media / Slack / Discord"
    },
    {
      "name": "product_card",
      "category": "web",
      "display_name": "Product Card Image",
      "aspect_ratio": "4:5",
      "recommended_size": "1K",
      "dimensions_px": "800x1000",
      "tips": [
        "Clean background (white or neutral)",
        "Product centered with padding",
        "Consistent lighting across product line"
      ],
      "best_for": "E-commerce product grids"
    },
    {
      "name": "linkedin_post",
      "category": "social",
      "display_name": "LinkedIn Post Image",
      "aspect_ratio": "1:1",
      "recommended_size": "1K",
      "dimensions_px": "1080x1080",
      "tips": [
        "Professional tone — avoid overly casual imagery",
        "Data visualizations and infographics perform well"
      ],
      "best_for": "LinkedIn feed posts"
    },
    {
      "name": "twitter_post",
      "category": "social",
      "display_name": "Twitter/X Post Image",
      "aspect_ratio": "16:9",
      "recommended_size": "1K",
      "dimensions_px": "1200x675",
      "tips": [
        "High contrast — Twitter feed is noisy",
        "Memes and bold statements perform well"
      ],
      "best_for": "Twitter/X feed posts"
    },
    {
      "name": "youtube_thumbnail",
      "category": "social",
      "display_name": "YouTube Thumbnail",
      "aspect_ratio": "16:9",
      "recommended_size": "2K",
      "dimensions_px": "1280x720",
      "tips": [
        "Large face + bold text = highest CTR",
        "Max 3-4 words of text",
        "Bright, saturated colors stand out"
      ],
      "best_for": "YouTube video thumbnails"
    },
    {
      "name": "email_header",
      "category": "web",
      "display_name": "Email Header Banner",
      "aspect_ratio": "3:1",
      "recommended_size": "1K",
      "dimensions_px": "600x200",
      "tips": [
        "Keep file size small — many email clients block large images",
        "Design must work without images loaded (alt text fallback)"
      ],
      "best_for": "Email marketing headers"
    }
  ]
}
```

**Behavior:**
- Presets are loaded from a `presets.json` config file
- Users can add custom presets by editing the file
- Returns filtered list based on `category` param

---

### 5. `list_generated`

Browse and search previously generated images in the output directory.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `filter` | string | No | Search term to filter by filename or metadata |
| `limit` | number | No (default: 20) | Max results to return |
| `include_blueprints` | boolean | No (default: false) | Include cached JSON blueprints in results |

**Returns:**
```json
{
  "images": [
    {
      "path": "/output/hero.png",
      "created_at": "2026-03-22T10:30:00Z",
      "size_bytes": 2048000,
      "metadata": {
        "model": "gemini-3.1-flash-image-preview",
        "preset": "hero_image",
        "prompt_preview": "Professional woman in modern office..."
      },
      "has_blueprint": true,
      "edit_history": ["hero-edit-1.png", "hero-edit-2.png"]
    }
  ],
  "total": 1
}
```

**Behavior:**
- Scans the output directory for `.png` files
- Reads companion `.meta.json` files for metadata
- Tracks edit chains (original → edit-1 → edit-2)

---

## MCP Prompt: `nano_banana_expert`

A rich prompt resource that Claude can invoke to become an expert at using this MCP. Contains:

```markdown
# Nano Banana Expert Guide

## JSON Schema Reference
You can structure image prompts as JSON for precise control. Here is the complete schema:

### Top-Level Fields
- `meta` — aspect_ratio, quality, seed, guidance_scale
- `subject[]` — array of characters/objects with: type, description, hair, clothing, accessories, position, pose, expression
- `scene` — location, time, weather, lighting (type + direction), background_elements
- `technical` — camera_model, lens, aperture, shutter_speed, iso, film_stock
- `composition` — framing, angle, focus_point
- `text_rendering` — enabled, text_content, placement, font_style, color
- `style_modifiers` — medium, aesthetic, artist_reference

### Key Enum Values
[Full enum lists from the schema for each field]

## Editing Best Practices

### When to use JSON edits:
- Changing specific attributes (hair color, clothing, accessories)
- Swapping colors (use hex codes like #FF5733 for precision)
- Modifying text content in the image
- Adjusting lighting or camera settings
- Any change that maps cleanly to a schema field

### When to use natural language edits:
- Complex scene changes ("move to a beach")
- Style/mood transformations ("make it look vintage")
- Abstract changes ("make it more dramatic")
- Multiple interrelated changes that are hard to express as field changes

### Editing Prompt Patterns:
- Always include: "Keep everything else EXACTLY the same"
- Use ALL CAPS for emphasis: "ONLY change the hair color"
- Use hex colors over names: "#E6BE8A" not "gold"
- For text: spell out EXACT characters, specify placement

## Asset Creation Guidelines

### Ad Creatives
- Call `get_presets` first to get platform-specific dimensions
- Facebook/Instagram: bright colors, minimal text (<20%), clear focal point
- Google Display: clear CTA, works at small sizes, avoid fine detail
- Story ads: vertical, bold, fast-read content

### Web Assets
- Hero images: leave text overlay space, work with dark AND light text
- Product cards: consistent lighting, clean backgrounds, centered subjects
- OG images: must be legible as thumbnails

### Brand Consistency
- Use `reference_images` param with character photos for consistency
- Use `consistency_id` in JSON prompts for multi-image series
- Keep a "brand blueprint" JSON and reuse `style_modifiers` + `technical` across assets

## Workflow Patterns

### Create new asset:
1. Check presets: `get_presets` → pick appropriate preset
2. Generate: `generate_image` with preset + prompt
3. If edits needed: `decompose_image` → modify blueprint → `edit_image`

### Edit existing asset:
1. `decompose_image` → get blueprint
2. Identify what to change
3. Simple change → `edit_image` with JSON changes
4. Complex change → `edit_image` with natural language

### Create brand series:
1. Generate hero image with detailed JSON prompt
2. `decompose_image` to get blueprint
3. Reuse blueprint's `style_modifiers`, `technical`, `scene.lighting` across subsequent `generate_image` calls
4. Use `reference_images` for character consistency
```

---

## MCP Resource: `json_schema`

Exposes the full Nano Banana JSON prompt schema as a readable resource at URI `nanobanana://schema/prompt`. This is the complete schema from alexewerlof's work, enriched with our editing extensions:

- All enum values for every field
- Descriptions and examples
- Editing-specific additions: `changes` format, dot-notation paths

---

## Project Structure

```
img-mcp/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── server.ts                 # Server setup, tool/prompt/resource registration
│   ├── tools/
│   │   ├── generate-image.ts     # generate_image tool
│   │   ├── decompose-image.ts    # decompose_image tool
│   │   ├── edit-image.ts         # edit_image tool
│   │   ├── get-presets.ts        # get_presets tool
│   │   └── list-generated.ts     # list_generated tool
│   ├── gemini/
│   │   ├── client.ts             # Gemini API client wrapper
│   │   ├── models.ts             # Model configs (flash vs pro)
│   │   └── prompts.ts            # System prompts for decomposition, editing
│   ├── schema/
│   │   ├── nano-banana.schema.json   # Full JSON prompt schema
│   │   └── validator.ts          # Schema validation utilities
│   ├── presets/
│   │   └── presets.json          # All asset presets (ad, web, social)
│   ├── storage/
│   │   ├── file-manager.ts       # Save/load images, blueprints, metadata
│   │   └── manifest.ts           # Track generated images + edit history
│   └── utils/
│       ├── image.ts              # Base64 encode/decode, format detection
│       └── merge.ts              # JSON blueprint merge (apply changes)
├── prompts/
│   └── nano-banana-expert.md     # MCP prompt content
├── output/                       # Default output directory (gitignored)
├── package.json
├── tsconfig.json
├── .env.example                  # GEMINI_API_KEY, OUTPUT_DIR
├── README.md
└── plan.md                       # This file
```

---

## Implementation Steps

### Phase 1: Foundation (Steps 1–4)

#### Step 1: Project Scaffolding
- Initialize npm project with TypeScript
- Install dependencies:
  - `@modelcontextprotocol/sdk` — MCP server SDK
  - `@google/genai` — Google Generative AI SDK
  - `zod` — runtime schema validation
- Set up `tsconfig.json` with strict mode, ESM output
- Create `.env.example` with `GEMINI_API_KEY` and `OUTPUT_DIR`
- Set up build script (`tsc`) and dev script (`tsx`)

#### Step 2: Gemini Client Layer
- Create `src/gemini/client.ts`:
  - Initialize `@google/genai` client with API key from env
  - Expose `generateContent()` wrapper that handles:
    - Text-only prompts
    - Text + image (base64 inline) prompts
    - Multi-turn chat sessions
    - Response parsing (extract text + image parts)
  - Handle errors: rate limits, safety blocks, invalid requests
- Create `src/gemini/models.ts`:
  - Model ID constants: `FLASH = "gemini-3.1-flash-image-preview"`, `PRO = "gemini-3-pro-image-preview"`
  - Default generation configs per model
- Create `src/gemini/prompts.ts`:
  - `DECOMPOSE_BASIC` — prompt for basic image decomposition
  - `DECOMPOSE_DETAILED` — prompt for detailed decomposition
  - `DECOMPOSE_EXHAUSTIVE` — prompt for exhaustive decomposition
  - `EDIT_JSON_TEMPLATE` — prompt template for JSON-based edits
  - `EDIT_NL_WITH_BLUEPRINT` — prompt template for NL edits with blueprint context
  - `EDIT_NL_WITHOUT_BLUEPRINT` — prompt template for NL edits without blueprint

#### Step 3: Storage & Utilities
- Create `src/storage/file-manager.ts`:
  - `saveImage(buffer, name)` → save PNG to output dir, return path
  - `saveBlueprint(imagePath, blueprint)` → save `.blueprint.json` alongside image
  - `loadBlueprint(imagePath)` → load cached blueprint if exists
  - `saveMetadata(imagePath, meta)` → save `.meta.json` with generation info
  - `listImages(filter?, limit?)` → scan output dir with optional filter
- Create `src/utils/image.ts`:
  - `imageToBase64(filePath)` → read image, return base64 string
  - `base64ToBuffer(b64)` → decode base64 to Buffer
  - `detectMimeType(filePath)` → return mime type from extension
- Create `src/utils/merge.ts`:
  - `applyChanges(blueprint, changes)` → deep merge changes (with dot-notation support like `subject[0].hair.color`) into the full blueprint
  - `diffBlueprint(original, modified)` → return list of changed paths

#### Step 4: JSON Schema & Presets
- Create `src/schema/nano-banana.schema.json` — the full prompt schema (from research)
- Create `src/schema/validator.ts`:
  - `validatePromptJson(json)` → validate against schema, return errors
  - `validateChanges(changes, blueprint)` → validate that change paths exist in blueprint
- Create `src/presets/presets.json` — all preset definitions (ad, web, social, print)

### Phase 2: Tool Implementation (Steps 5–9)

#### Step 5: `generate_image` Tool
- Implement in `src/tools/generate-image.ts`
- Input validation with Zod
- If `preset` provided: load preset, apply aspect_ratio and image_size (explicit params override)
- If `prompt_format` = `"json"`: validate JSON against schema
- If `reference_images` provided: load and base64-encode each
- Build Gemini request with `responseModalities: ["TEXT", "IMAGE"]`
- Parse response: extract image data (base64 PNG)
- Save image + metadata to output directory
- Return result with path + metadata

#### Step 6: `decompose_image` Tool
- Implement in `src/tools/decompose-image.ts`
- Load image from `image_path`, base64-encode
- Select decomposition prompt based on `detail_level`
- Send to Gemini: image + decomposition prompt
- Parse response: extract JSON from text response
- Validate extracted JSON against schema (best-effort, don't reject)
- Cache blueprint as `.blueprint.json`
- Return blueprint

#### Step 7: `edit_image` Tool
- Implement in `src/tools/edit-image.ts`
- **JSON edit path:**
  1. Load image + blueprint (from param or cache)
  2. Apply `changes` to blueprint using `merge.ts`
  3. Build prompt using `EDIT_JSON_TEMPLATE`
  4. Send image + prompt to Gemini
  5. Save edited image with incremented name (`-edit-1`, `-edit-2`)
  6. Update blueprint cache with merged version
- **Natural language edit path:**
  1. Load image
  2. If blueprint available, include as context
  3. Build prompt using appropriate NL template
  4. Send image + prompt to Gemini
  5. Save edited image
  6. Invalidate blueprint cache (NL edits may change anything)
- Both paths: save metadata tracking edit chain

#### Step 8: `get_presets` Tool
- Implement in `src/tools/get-presets.ts`
- Load `presets.json`
- Filter by `category` if provided
- Return filtered list

#### Step 9: `list_generated` Tool
- Implement in `src/tools/list-generated.ts`
- Scan output directory for `.png` files
- Read companion `.meta.json` files
- Check for `.blueprint.json` existence
- Track edit chains from metadata
- Apply `filter` search, `limit` cap
- Return results

### Phase 3: MCP Integration (Steps 10–12)

#### Step 10: MCP Server Setup
- Create `src/server.ts`:
  - Initialize MCP server with `@modelcontextprotocol/sdk`
  - Register all 5 tools with their schemas
  - Register `nano_banana_expert` prompt
  - Register `json_schema` resource
- Create `src/index.ts`:
  - Load env vars
  - Validate `GEMINI_API_KEY` exists
  - Create output directory if needed
  - Start server on stdio transport

#### Step 11: MCP Prompt Registration
- Register `nano_banana_expert` prompt:
  - Name: `nano_banana_expert`
  - Description: "Comprehensive guide for creating and editing images with Nano Banana"
  - Content: loaded from `prompts/nano-banana-expert.md`
- Register `json_schema` resource:
  - URI: `nanobanana://schema/prompt`
  - Description: "Complete Nano Banana JSON prompt schema"
  - Content: loaded from `src/schema/nano-banana.schema.json`

#### Step 12: Build & Package
- Configure `package.json`:
  - `"bin"` entry pointing to compiled `dist/index.js`
  - `"type": "module"` for ESM
  - Build script: `tsc`
  - Shebang line in entry point for direct execution
- Add `claude mcp add` instructions in README
- Add `.cursor/mcp.json` example config
- Test end-to-end: generate → decompose → edit → list

### Phase 4: Polish (Steps 13–15)

#### Step 13: Error Handling & Edge Cases
- Gemini safety blocks → return helpful error with suggestion to rephrase
- Rate limiting → retry with exponential backoff (max 3 attempts)
- Invalid image paths → clear error message
- Decomposition returns unparseable JSON → fallback to basic extraction
- Large images → warn if > 20MB, suggest resize

#### Step 14: Testing
- Unit tests for:
  - `merge.ts` — dot-notation path resolution, deep merge
  - `validator.ts` — schema validation
  - `file-manager.ts` — save/load/list operations
- Integration tests for:
  - Full generate → decompose → edit workflow
  - Preset application
  - Reference image handling

#### Step 15: Documentation
- README.md:
  - Quick start (API key setup, installation)
  - Claude Code integration (`claude mcp add`)
  - All tools with examples
  - Preset customization guide
  - JSON editing workflow walkthrough
- Update `api_test.html` with tool test interface
- Update `uiflow.md` with user workflow diagrams

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key |
| `OUTPUT_DIR` | No | `./output` | Where generated images are saved |
| `DEFAULT_MODEL` | No | `flash` | Default model: `flash` or `pro` |
| `DEFAULT_IMAGE_SIZE` | No | `1K` | Default resolution |
| `MAX_EDIT_HISTORY` | No | `10` | Max edit versions to keep per image |

### Claude Code Integration

```bash
claude mcp add nanobanana -- node /path/to/img-mcp/dist/index.js
```

Or in `.claude/mcp.json`:
```json
{
  "mcpServers": {
    "nanobanana": {
      "command": "node",
      "args": ["/path/to/img-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-key-here",
        "OUTPUT_DIR": "./generated-assets"
      }
    }
  }
}
```

---

## JSON Edit Format — Quick Reference

### Dot-notation paths for `changes` object:

```
subject[0].hair.color          → Change first subject's hair color
subject[0].clothing[1].color   → Change second clothing item's color
scene.lighting.type            → Change lighting type
scene.location                 → Change entire location
text_rendering.text_content    → Change rendered text
text_rendering.color           → Change text color
meta.aspect_ratio              → Change aspect ratio
technical.lens                 → Change camera lens
composition.framing            → Change shot framing
style_modifiers.aesthetic      → Change aesthetic style
```

### Example: Full edit cycle

```
Step 1: Generate
  → generate_image(prompt: "Professional headshot of a woman in a navy blazer", preset: "linkedin_post")
  → Returns: /output/headshot.png

Step 2: Decompose
  → decompose_image(image_path: "/output/headshot.png", detail_level: "detailed")
  → Returns: Full JSON blueprint with all detected components

Step 3: Edit (JSON)
  → edit_image(
      image_path: "/output/headshot.png",
      edit_type: "json",
      changes: {
        "subject[0].clothing[0].color": "#8B0000",
        "scene.lighting.type": "studio_softbox"
      }
    )
  → Returns: /output/headshot-edit-1.png

Step 4: Edit (Natural Language)
  → edit_image(
      image_path: "/output/headshot-edit-1.png",
      edit_type: "natural_language",
      instruction: "Add a subtle bokeh effect to the background with warm golden tones"
    )
  → Returns: /output/headshot-edit-1-edit-1.png
```

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "@google/genai": "^1.x",
    "zod": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/node": "^22.x",
    "vitest": "^3.x"
  }
}
```
