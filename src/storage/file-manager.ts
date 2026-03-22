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
