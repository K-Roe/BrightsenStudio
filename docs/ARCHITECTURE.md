# Architecture

BrightSen Studio is a secure Electron desktop application with a React renderer and a TypeScript main process.

## Principles

- Local-first: projects, characters, assets and exports remain on the user's computer.
- Secure by default: the renderer has no unrestricted Node.js access.
- Typed boundaries: renderer-to-main calls go through validated IPC contracts.
- Deterministic output: character assets and 2D render state will be reused consistently instead of relying on generative video.
- Milestone delivery: every milestone must open, run checks and update `TODO.md`.

## Process Model

```text
React renderer
  -> window.studio preload API
  -> typed IPC contracts
  -> Electron main services
  -> SQLite metadata and local files
```

The renderer presents the friendly workflow. The main process owns file access, dialogs, database work, logging, future workers and export processes.

## Storage

The app-data service creates:

```text
BrightSenStudio/
  database/
  characters/
  projects/
  assets/
  renders/
  exports/
  cache/
  logs/
  models/
  backups/
```

SQLite stores metadata only. Large assets are referenced by path and stored in the relevant folder.

## IPC

IPC channels are declared in `src/shared/ipc.ts`. Requests and responses are validated with Zod on both sides where practical. The preload exposes only a narrow `window.studio` API.

Current channels:

- `app:getHealth`
- `character:list`
- `character:createDraft`
- `character:get`
- `character:updateMarkers`
- `character:rebuildPuppet`
- `image:analyze`
- `dialog:selectImage`
- `asset:list`
- `project:list`
- `project:createFromPrompt`
- `export:list`
- `export:create`

## Local Cartoon Workflow

The current workflow is deliberately local and deterministic:

1. The user imports one drawing and Studio creates a character package with cleaned image data, silhouette metadata, estimated body markers, a starter skeleton and starter animations.
2. The user corrects body markers from the character screen and rebuilds the saved puppet metadata.
3. The story screen parses plain prompts into ordered timeline clips without cloud AI.
4. Generated projects target calm YouTube Shorts: 1080 x 1920, 30 FPS, always-on subtitles, no flashing content and predictable pacing for autistic children.
5. The scene editor previews the selected project with a vertical stage, timeline cursor, segmented character layers, marker overlay, simple starter props and dialogue subtitles.
6. The exports screen creates a local HTML preview export with the segmented character layers embedded into the file.
7. MP4 export renders deterministic local frames and encodes H.264 through bundled FFmpeg.

## Database

Migrations live in `src/main/database/migrations.ts` and are applied by `openStudioDatabase`. The first migration creates core tables for settings, characters, projects, assets and exports.

## Error Handling

Technical errors are written to JSONL logs with timestamp, area, severity, message and optional project or character identifiers. The renderer error boundary shows user-friendly recovery language and avoids stack traces.

## Future Workers

Image processing, background removal, puppet building, audio analysis and rendering should run outside the renderer. Worker processes will report progress, cancellation and user-friendly failure messages through main-process services.
