# gemini-image-studio-mcp

MCP server for AI image generation and editing with Google Gemini. Create web assets, ad creatives, and brand visuals — with structured JSON editing for precise, repeatable control.

[![npm version](https://img.shields.io/npm/v/gemini-image-studio-mcp.svg)](https://www.npmjs.com/package/gemini-image-studio-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What Makes This Different

Most Gemini image MCP servers are basic text-to-image wrappers. This one adds a **structured editing pipeline**:

1. **Generate** an image from text or JSON prompts
2. **Decompose** it into a structured JSON blueprint (every visual component mapped)
3. **Edit** by changing specific fields — `subject[0].hair.color: "platinum_blonde"` — and regenerating

This means precise, isolated changes without affecting the rest of the image. Change a hair color without touching the background. Swap clothing without altering the pose. All through dot-notation JSON paths.

## Features

- **5 MCP Tools** — generate, decompose, edit, presets, list
- **Structured JSON Editing** — decompose images into blueprints, edit specific fields with dot-notation
- **Natural Language Editing** — or just describe the change in plain English
- **10 Built-in Presets** — Facebook ads, Instagram stories, hero images, OG images, YouTube thumbnails, and more
- **Reference Image Support** — up to 14 reference images for character/object consistency
- **Dual Model Support** — Gemini 3.1 Flash (fast) or Gemini 3 Pro (best quality)
- **Blueprint Caching** — decomposed blueprints cached alongside images for instant re-edits
- **Google Search Grounding** — real-world accuracy via web search
- **Smart Error Handling** — retry on rate limits, clear safety block messages, file size warnings

## Quick Start

### 1. Get a Gemini API Key

Get one free at [Google AI Studio](https://aistudio.google.com/apikey).

### 2. Install

```bash
npm install -g gemini-image-studio-mcp
```

### 3. Add to Claude Code

```bash
claude mcp add gemini-image-studio-mcp -e GEMINI_API_KEY=your-key-here -- gemini-image-studio-mcp
```

Or add to your project's `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "gemini-image-studio-mcp": {
      "command": "npx",
      "args": ["-y", "gemini-image-studio-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-key-here"
      }
    }
  }
}
```

### 4. Use It

Ask Claude to generate images:

> "Create a Facebook ad for a coffee shop with warm lighting"

> "Generate a hero image for a tech startup landing page"

> "Edit the hero image — change the background to a sunset beach"

## Tools

### `generate_image`

Create a new image from text or structured JSON prompts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description or JSON prompt |
| `prompt_format` | `"text"` \| `"json"` | No | Prompt format (default: `"text"`) |
| `preset` | string | No | Asset preset (e.g., `"facebook_ad"`, `"hero_image"`) |
| `aspect_ratio` | string | No | Override ratio (`"1:1"`, `"16:9"`, `"9:16"`, etc.) |
| `image_size` | `"1K"` \| `"2K"` \| `"4K"` | No | Resolution (default: `"1K"`) |
| `model` | `"flash"` \| `"pro"` | No | Gemini model (default: `"flash"`) |
| `reference_images` | string[] | No | Paths to reference images for consistency |
| `output_name` | string | No | Custom filename |
| `enable_search_grounding` | boolean | No | Use Google Search for accuracy |

### `decompose_image`

Analyze an image into a structured JSON blueprint — the first step of the edit workflow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_path` | string | Yes | Path to the image |
| `detail_level` | `"basic"` \| `"detailed"` \| `"exhaustive"` | No | Granularity (default: `"detailed"`) |

Returns a full blueprint with `subject`, `scene`, `technical`, `composition`, `text_rendering`, `style_modifiers`, and `meta` sections — each field precisely describing the image's visual components.

### `edit_image`

Edit an image using JSON changes or natural language.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_path` | string | Yes | Path to the image |
| `edit_type` | `"json"` \| `"natural_language"` | Yes | Edit mode |
| `changes` | object | For JSON edits | Dot-notation paths to change |
| `instruction` | string | For NL edits | Natural language instruction |
| `blueprint` | object | No | Blueprint (auto-loaded from cache if omitted) |
| `model` | `"flash"` \| `"pro"` | No | Model (default: `"flash"`) |
| `output_name` | string | No | Custom filename |

**JSON edit example** — change hair color and add sunglasses:
```json
{
  "image_path": "/output/portrait.png",
  "edit_type": "json",
  "changes": {
    "subject[0].hair.color": "platinum_blonde",
    "subject[0].accessories": [
      { "item": "sunglasses", "material": "metal", "color": "#C0C0C0" }
    ]
  }
}
```

**Natural language edit example:**
```json
{
  "image_path": "/output/portrait.png",
  "edit_type": "natural_language",
  "instruction": "Change the background to a tropical beach at sunset. Keep the person exactly the same."
}
```

### `get_presets`

List available asset presets with dimensions, tips, and conventions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | `"ad"` \| `"web"` \| `"social"` \| `"all"` | No | Filter (default: `"all"`) |

### `list_generated`

Browse previously generated images.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter` | string | No | Search by filename |
| `limit` | number | No | Max results (default: 20) |
| `include_blueprints` | boolean | No | Include cached blueprints |

## JSON Editing Workflow

The key differentiator — precise, field-level image editing:

```
Step 1: Generate
  generate_image(prompt: "Professional headshot, navy blazer", preset: "linkedin_post")
  → /output/headshot.png

Step 2: Decompose
  decompose_image(image_path: "/output/headshot.png")
  → JSON blueprint with every visual component mapped

Step 3: Edit (precise)
  edit_image(
    image_path: "/output/headshot.png",
    edit_type: "json",
    changes: {
      "subject[0].clothing[0].color": "#8B0000",
      "scene.lighting.type": "studio_softbox"
    }
  )
  → /output/headshot-edit-1.png (blazer changed to dark red, lighting adjusted)

Step 4: Edit (creative)
  edit_image(
    image_path: "/output/headshot-edit-1.png",
    edit_type: "natural_language",
    instruction: "Add warm bokeh to the background"
  )
  → /output/headshot-edit-1-edit-1.png
```

### Dot-Notation Paths

```
subject[0].hair.color          → Hair color
subject[0].hair.style          → Hair style
subject[0].clothing[0].color   → First clothing item color
subject[0].accessories         → Add/change accessories
scene.lighting.type            → Lighting type
scene.location                 → Location/background
text_rendering.text_content    → Text in image
technical.lens                 → Camera lens
composition.framing            → Shot framing
style_modifiers.aesthetic      → Aesthetic style
```

## Built-in Presets

| Preset | Category | Aspect Ratio | Dimensions | Best For |
|--------|----------|-------------|------------|----------|
| `facebook_ad` | Ad | 1:1 | 1080x1080 | Facebook/Instagram feed ads |
| `instagram_story_ad` | Ad | 9:16 | 1080x1920 | Instagram/Facebook story ads |
| `google_display_banner` | Ad | 16:9 | 1200x628 | Google Display Network |
| `hero_image` | Web | 21:9 | 2560x1080 | Above-the-fold hero sections |
| `og_image` | Web | 16:9 | 1200x630 | Social share / link previews |
| `product_card` | Web | 4:5 | 800x1000 | E-commerce product grids |
| `email_header` | Web | 3:1 | 600x200 | Email marketing headers |
| `linkedin_post` | Social | 1:1 | 1080x1080 | LinkedIn feed posts |
| `twitter_post` | Social | 16:9 | 1200x675 | Twitter/X posts |
| `youtube_thumbnail` | Social | 16:9 | 1280x720 | YouTube thumbnails |

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | [Google AI Studio](https://aistudio.google.com/apikey) API key |
| `OUTPUT_DIR` | No | `./output` | Where generated images are saved |

## Integration

### Claude Code

```bash
claude mcp add gemini-image-studio-mcp -e GEMINI_API_KEY=your-key -- gemini-image-studio-mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gemini-image-studio-mcp": {
      "command": "npx",
      "args": ["-y", "gemini-image-studio-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Any MCP Client

```bash
GEMINI_API_KEY=your-key npx gemini-image-studio-mcp
```

The server communicates over stdio using the [Model Context Protocol](https://modelcontextprotocol.io/).

## MCP Prompt & Resource

This server also exposes:

- **Prompt: `nano_banana_expert`** — invoke this to give Claude full knowledge of the JSON schema, editing best practices, and asset creation guidelines
- **Resource: `nanobanana://schema/prompt`** — the raw JSON schema with all enum values for programmatic access

## Models

| Model | ID | Best For |
|-------|------|----------|
| Flash (default) | `gemini-3.1-flash-image-preview` | Fast generation, high volume, cost-effective |
| Pro | `gemini-3-pro-image-preview` | Best quality, complex scenes, professional assets |

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run tests (`npm test`)
4. Commit your changes
5. Push and open a PR

## License

[MIT](LICENSE)
