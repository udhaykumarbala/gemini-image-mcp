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
    name: "gemini-image-studio-mcp",
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
