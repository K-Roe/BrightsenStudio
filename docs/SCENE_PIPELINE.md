# Scene Pipeline

The scene pipeline converts simple story text into a deterministic timeline for preview and export.

## Implemented Flow

1. Choose one reusable character.
2. Select or infer a background.
3. Type a short scene description.
4. Parse clear sentence patterns locally.
5. Build a 9:16 YouTube Shorts project with calm autism-friendly defaults.
6. Generate an editable timeline.
7. Preview the real cleaned character image with subtitles, props and a playback cursor.
8. Export a local HTML preview with embedded character layers.
9. Export a local H.264 MP4 through bundled FFmpeg, with AAC narration when Windows system TTS is available.

## Planned Flow

1. Support multiple reusable characters.
2. Add manual clip snapping and expression controls.
3. Add imported props and backgrounds.
4. Add render progress and cancellation.
5. Add imported audio and volume-based lip sync.

## Local Parser First

The first parser will support common commands such as:

- `Max walks in`
- `Max waves`
- `Max talks`
- `Max smiles`
- `Max looks at the bright star`
- `Max looks at Mia`
- `Mia sits`
- `Max picks up the ball`
- `Max leaves`

Cloud or local AI providers can assist later, but the app must remain useful without paid external services.

## Autism-Friendly Shorts Defaults

- Vertical 1080 x 1920 canvas.
- 30 FPS.
- Calm sensory intensity.
- Always-on high-contrast subtitles.
- No flashing content.
- No sudden audio.
- Predictable clip lengths and soft transitions.
