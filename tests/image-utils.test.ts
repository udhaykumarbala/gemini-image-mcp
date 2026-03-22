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
