# Testing

BrightSen Studio uses TypeScript checks, ESLint and Vitest from the first milestone.

## Commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run package:check
```

## Test Areas

Unit tests:

- IPC contract validation.
- Character package validation.
- Image validation.
- Project save/load.
- Story parsing.
- Animation timing.
- Timeline operations.
- Asset metadata.
- Render configuration.
- File cleanup.
- Database migrations.

Integration tests:

- Import character.
- Build character.
- Save and reopen character.
- Create scene.
- Add animation and dialogue.
- Save and reopen project.
- Render preview.
- Export MP4.

UI tests:

- First launch.
- Character wizard.
- Guided correction mode.
- Character library.
- Story wizard.
- Scene editor.
- Export workflow.
- Error recovery.
