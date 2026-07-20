# BrightSen Studio Production Audit

Date: 2026-07-20

## Product Goal

BrightSen Studio is being built as a local-first desktop studio for creating calm YouTube Shorts cartoons for autistic children from one character drawing and a plain-language prompt.

## Current System Pass

### Character Import

- Imports PNG, JPG, JPEG and WebP drawings.
- Creates a fixed 900 x 1200 working character image for repeatable processing.
- Saves original, adjusted, cleaned and silhouette files into a local character package.
- Runs alpha or plain-background foreground extraction.
- Removes isolated mask noise before calculating silhouette bounds.

### Character Mapping

- Creates body markers for head, neck, shoulders, elbows, wrists, hips, knees and ankles.
- New default markers are fitted to detected silhouette bounds.
- Marker corrections are saved into the character manifest.
- Rebuilding the puppet saves starter skeleton and animation metadata.
- Rebuilding the puppet generates separate PNG layers for legs, torso, head and arms from the cleaned drawing.

### Story And Timeline

- Uses deterministic local prompt parsing.
- Produces 9:16 YouTube Shorts projects at 1080 x 1920 and 30 FPS.
- Uses an autism-friendly profile: calm sensory intensity, no flashing content, no sudden audio and always-on high-contrast subtitles.
- Uses slower clip timings and predictable transitions.
- Detects the starter bright-star prop when the prompt mentions a star.

### Preview

- Scene editor composes the generated character layers, falling back to the cleaned character image only when layers are unavailable.
- Shows marker overlay for checking whether the drawing has been mapped correctly.
- Shows simple starter prop placement and always-on subtitles.
- Uses a vertical Shorts stage.

### Export

- Local HTML preview export embeds segmented character layers as data URIs, falling back to the real cleaned character image when needed.
- Export uses the same Shorts format, subtitle and starter prop data as the editor.
- MP4 export uses bundled local FFmpeg to encode deterministic generated frames to H.264 MP4.
- MP4 export attempts local Windows system TTS narration and muxes AAC audio when speech synthesis succeeds.
- Temporary render frames are removed after successful MP4 export.

## Remaining Quality Gaps

- The character has separate local image layers, but the limb animation is still first-pass transform animation rather than advanced mesh deformation or inpainting repaired joints.
- MP4 rendering needs progress reporting and cancellation.
- Imported audio tracks and volume-based lip sync remain open.
- Imported props/backgrounds need image import, thumbnail generation and storage.
- UI coverage still needs Playwright or equivalent end-to-end tests for the full release workflow.
- Installer branding and signing need release assets and certificate details.

## Engineering Direction

The next major quality step is higher-fidelity layer deformation: better limb masks, repaired joints behind separated limbs, facial controls, mouth shapes and audio/TTS timing.
