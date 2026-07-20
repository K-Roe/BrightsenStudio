# Decisions

## 2026-07-20: Start with Electron, React and TypeScript

Electron is the desktop foundation because the product needs reliable local file access, worker processes, FFmpeg integration and Windows packaging.

## 2026-07-20: Keep the renderer sandboxed behind a preload API

The renderer does not receive direct Node.js access. It talks to a narrow `window.studio` API exposed by preload and backed by typed IPC handlers.

## 2026-07-20: Store large media on disk and metadata in SQLite

Images, generated layers, rendered frames and MP4 files will live in app-data folders. SQLite stores searchable metadata and file references.

## 2026-07-20: Use sql.js for the first SQLite milestone

The first implementation uses `sql.js` and persists a real SQLite database file in app data. This avoids native `better-sqlite3` compilation failures on Windows machines without Python while preserving the migration and metadata model.

## 2026-07-20: Use deterministic 2D rendering as the core product path

Generative video is not the main renderer. Studio will render reusable character assets through a deterministic 2D stage so characters stay consistent.

## 2026-07-20: Keep local package checks unsigned

Local Windows package checks set `signAndEditExecutable` to `false` because this machine could not unpack electron-builder's code-signing helper symlinks without elevated Windows privileges. Release signing should be added when certificate details are available.

## 2026-07-20: Keep Milestone 2 image cleanup simple and local

The first import wizard uses Electron's `nativeImage` for read/dimension checks and renderer canvas for preview adjustments. The `Remove Background` action uses a conservative corner-colour cleanup so the feature is usable before the stronger segmentation pipeline lands in Milestone 3.

## 2026-07-20: Use pure JavaScript PNG processing for Milestone 3

The first saved preparation pipeline uses `pngjs` so cleaned images and silhouettes can be generated without native image-processing dependencies. OpenCV or model-backed providers can be introduced later behind service boundaries.
