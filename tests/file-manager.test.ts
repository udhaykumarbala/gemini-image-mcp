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
