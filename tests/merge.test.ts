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
    expect(result.subject[0].hair.style).toBe("pixie_cut");
    expect(result.scene.lighting.type).toBe("neon_lights");
    expect(result.scene.location).toBe("office");
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
