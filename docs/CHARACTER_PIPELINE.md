# Character Pipeline

The character pipeline turns one clean drawing into a reusable package. The current build creates import-ready character packages with original source image, adjusted PNG source image, cleaned image, silhouette metadata, marker mapping and starter puppet metadata.

## Current Implemented Steps

- Image selection through secure IPC.
- Image readability, type, size and dimension checks.
- Preview data URL generation through Electron `nativeImage`.
- Renderer-side crop, rotate, centre, scale and simple corner-background cleanup.
- Character package creation with original and adjusted source images.
- Alpha segmentation for transparent PNG sources.
- Plain-background colour segmentation using corner sampling.
- Small-noise mask cleanup before silhouette bounds are calculated.
- Safe whole-character fallback when isolation is unreliable.
- Saved `cleaned/character.png`, `cleaned/silhouette.png` and `cleaned/silhouette.json`.
- Silhouette-fitted body markers for head, neck, shoulders, elbows, wrists, hips, knees and ankles.
- Guided marker correction and saved puppet rebuilds.
- Starter skeleton and starter animations for idle, blink, talk, wave and walking.
- Segmented PNG layer generation for legs, torso, head and arms.

## User Workflow

1. Choose `Create Character`.
2. Enter the character name.
3. Choose a drawing.
4. Review image quality.
5. Crop, centre, rotate or remove background where needed.
6. Press `Build My Character`.
7. Open the character package.
8. Correct body markers over the cleaned drawing.
9. Rebuild the puppet.
10. Use the character in a story.

## Planned Pipeline Steps

1. Validate image.
2. Normalise image.
3. Remove background.
4. Detect character silhouette.
5. Detect approximate body regions.
6. Estimate head position.
7. Estimate torso position.
8. Estimate arms.
9. Estimate legs.
10. Create separated visual layers.
11. Repair missing areas behind separated limbs.
12. Place character pivots.
13. Build internal skeleton.
14. Create neutral pose.
15. Create face controls.
16. Create mouth shapes.
17. Create blink frames.
18. Create expression variants.
19. Generate preview animations.
20. Save character package.

Steps 10, 12, 13, 19 and 20 have a first local implementation. The next quality step is improving layer masks, joint repair and facial/mouth controls.

## Fallback Hierarchy

Studio should attempt the most reliable local method first and degrade gracefully:

1. Transparent alpha segmentation.
2. Plain-background colour segmentation.
3. Foreground detection.
4. Contour detection.
5. Pose estimation.
6. Geometric estimation.
7. Guided correction mode.
8. Safe whole-character fallback.

The user should never be left with a blank character or unexplained technical failure.

## Package Layout

```text
characters/
  character-id/
    character.json
    source/
    cleaned/
    layers/
    face/
    mouths/
    expressions/
    animations/
    thumbnails/
    previews/
```

`character.json` is versioned and validated. Rebuilds must back up the previous package before writing a replacement.
