# Nano Banana MCP — User Workflows

## Flow 1: Generate New Asset
1. `get_presets(category: "ad")` → Pick appropriate preset
2. `generate_image(prompt: "...", preset: "facebook_ad")` → Get image path
3. Review generated image

## Flow 2: Edit Existing Asset (JSON — Precise Changes)
1. `decompose_image(image_path: "/output/hero.png")` → Get JSON blueprint
2. Identify fields to change in the blueprint
3. `edit_image(image_path: "/output/hero.png", edit_type: "json", changes: {"subject[0].hair.color": "platinum_blonde"})` → Get edited image

## Flow 3: Edit Existing Asset (Natural Language — Complex Changes)
1. `edit_image(image_path: "/output/hero.png", edit_type: "natural_language", instruction: "Change the background to a tropical beach at sunset")` → Get edited image

## Flow 4: Create Brand Series
1. Generate hero image with detailed JSON prompt
2. `decompose_image` to get blueprint
3. Reuse blueprint's `style_modifiers`, `technical`, `scene.lighting` in subsequent `generate_image` calls
4. Use `reference_images` for character consistency across assets

## Flow 5: Browse Generated History
1. `list_generated()` → See all generated images
2. `list_generated(filter: "hero", include_blueprints: true)` → Find specific images with blueprints
