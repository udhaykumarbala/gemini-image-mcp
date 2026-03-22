# Changelog

## 1.0.0 (2026-03-22)

### Features

- **generate_image** — Create images from text or structured JSON prompts with preset support for ads, web assets, and social media
- **decompose_image** — Analyze any image into a structured JSON blueprint describing every visual component
- **edit_image** — Edit images using precise JSON dot-notation changes or natural language instructions
- **get_presets** — Browse 10 built-in asset presets (Facebook ads, Instagram stories, hero images, OG images, product cards, and more)
- **list_generated** — Search and browse previously generated images with metadata and edit history
- **nano_banana_expert** MCP prompt — Rich context guide teaching Claude the full JSON schema and editing best practices
- **JSON schema resource** — Complete Nano Banana prompt schema exposed as an MCP resource
- Retry logic with exponential backoff for rate limits (429)
- Safety block detection with user-friendly error messages
- File size warnings for images exceeding 20MB
- Blueprint caching alongside images for instant re-edits
