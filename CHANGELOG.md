# Changelog

## 0.1.0

- Started BrightSen Studio as a new Electron, React and TypeScript desktop application.
- Added Milestone 1 app shell, secure IPC contracts, local app-data layout, SQLite migrations and structured logging.
- Added Home and Characters screens with draft character package creation.
- Added Windows unpacked packaging and NSIS installer generation.
- Switched the first SQLite implementation to `sql.js` to avoid native build failures on Windows development machines without node-gyp Python.
- Added Milestone 2 character import wizard with image selection, validation, preview, quality report, crop/position controls, simple background cleanup, undo/reset and `Build My Character` package persistence.
- Added Milestone 3 character preparation service with alpha segmentation, plain-background segmentation, safe whole-character fallback, cleaned PNG output, silhouette PNG output and body-region metadata.
