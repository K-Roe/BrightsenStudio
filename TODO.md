# BrightSen Studio TODO

## Milestone 1: Application shell, storage, database and secure IPC

- [x] Create repository structure.
- [x] Write `README.md`.
- [x] Write `docs/ARCHITECTURE.md`.
- [x] Write `docs/CHARACTER_PIPELINE.md`.
- [x] Write `docs/SCENE_PIPELINE.md`.
- [x] Write `docs/TESTING.md`.
- [x] Write `docs/DECISIONS.md`.
- [x] Write `docs/PRODUCTION_AUDIT.md`.
- [x] Create Electron, React and TypeScript shell.
- [x] Create secure preload bridge.
- [x] Create typed IPC contracts.
- [x] Create app-data directory service.
- [x] Create SQLite migration system.
- [x] Create structured logging.
- [x] Create user-friendly error boundary.
- [x] Create Home screen.
- [x] Create Characters screen.
- [x] Run all checks and fix errors.
- [x] Run the application for smoke testing.
- [x] Generate Windows unpacked package and NSIS installer.

Known Milestone 1 follow-ups:

- [ ] Add a production BrightSen Studio icon before release signing.
- [ ] Replace local unsigned packaging with signed release packaging when certificate details are available.
- [x] Review npm audit findings before distributing an installer outside development.

## Milestone 2: Character import and image-quality checks

- [x] Build character import wizard.
- [x] Validate PNG, JPG, JPEG and WebP files.
- [x] Detect file readability and corruption.
- [x] Check dimensions and excessive size.
- [x] Estimate transparent background availability.
- [x] Estimate full-body, arms and legs visibility.
- [x] Show friendly import-quality report.
- [x] Add crop, rotate, centre, scale, remove-background, undo and reset controls.
- [x] Add `Build My Character` action.
- [x] Persist original and adjusted source images into the character package.
- [x] Run checks, package smoke and app smoke.

Known Milestone 2 follow-ups:

- [ ] Replace simple corner-colour background cleanup with the stronger segmentation pipeline in Milestone 3.
- [ ] Improve arms and legs confidence after silhouette extraction exists.
- [ ] Add automated UI coverage for the import wizard once Playwright is wired.

## Milestone 3: Background removal and silhouette extraction

- [x] Implement alpha segmentation.
- [x] Implement plain-background colour segmentation.
- [x] Implement foreground and contour fallbacks.
- [x] Save cleaned images and silhouette metadata.
- [x] Show progress and user-friendly failures.
- [x] Run checks, package smoke and app smoke.

Known Milestone 3 follow-ups:

- [ ] Replace rectangular body-region estimates with guided marker correction in Milestone 4.
- [x] Add stronger contour cleanup and small-noise removal before puppet separation.
- [x] Add visual cleaned image and marker preview to the character detail workflow.
- [ ] Add visual silhouette preview to the character detail workflow.

## Milestone 4: Guided body-marker editor

- [x] Add draggable markers for head, neck, shoulders, elbows, wrists, hips, knees and ankles.
- [x] Add friendly correction prompts.
- [x] Save corrected marker positions.
- [x] Preview basic movement from corrected markers.

## Milestone 5: Basic reusable puppet

- [x] Build skeleton model.
- [x] Support head, torso, arms and legs.
- [x] Support flipping, scaling and layer ordering.
- [x] Validate saved character packages.
- [x] Generate separate local PNG layers for head, torso, arms and legs from the cleaned drawing.

## Milestone 6: Idle, blink, talk and wave

- [x] Add idle animation.
- [x] Add blink animation.
- [x] Add talking mouth changes.
- [x] Add wave animation.
- [x] Preview starter animations from the character screen.

## Milestone 7: Walking and character movement

- [x] Add walk in place.
- [x] Add walk left and walk right.
- [x] Add stage movement with clean idle return.

## Milestone 8: Character library and persistence

- [x] Add preview, edit and rebuild actions.
- [x] Add duplicate and delete actions.
- [x] Add delete confirmation.
- [ ] Add portable character package export and import.

## Milestone 9: Background and prop library

- [x] Add starter backgrounds.
- [x] Add starter props.
- [ ] Support imported transparent PNG assets.
- [x] Store starter asset metadata.
- [ ] Store imported asset thumbnails.

## Milestone 10: Scene editor and preview stage

- [x] Build left asset library, centre stage, right properties and bottom timeline layout.
- [x] Add characters and backgrounds.
- [x] Add starter props to the stage.
- [x] Move, scale and flip characters from timeline state.
- [x] Select animations and dialogue from generated clips.
- [ ] Add manual expression controls.

## Milestone 11: Simple story parser

- [x] Parse common local scene commands.
- [x] Create internal scene and shot representation.
- [x] Keep parser deterministic without requiring cloud AI.

## Milestone 12: Automatic timeline creation

- [x] Convert parsed stories to timeline clips.
- [x] Add clip ordering and playback cursor.
- [ ] Add manual snapping controls.

## Milestone 13: Audio and lip-sync

- [ ] Support imported audio.
- [x] Support system TTS where available for MP4 narration.
- [x] Add text-driven talking-mouth fallback.
- [ ] Add simple volume-based lip-sync fallback.

## Milestone 14: MP4 rendering

- [x] Render deterministic local preview exports with real cleaned character images.
- [x] Encode H.264 MP4 through bundled local FFmpeg.
- [x] Add preview and MP4 export presets.
- [ ] Add render progress and cancellation.
- [x] Clean temporary frames after successful exports.

## Milestone 15: Full create-cartoon wizard

- [x] Build `Create My Cartoon` workflow.
- [x] Parse prompt, choose assets, create timeline, preview and export local preview files.
- [x] Use calm 9:16 YouTube Shorts defaults for autistic children.
- [x] Export local H.264 MP4 through bundled FFmpeg.
- [x] Add AAC audio when system TTS exists.
- [ ] Add imported audio tracks.

## Milestone 16: Testing, packaging and polish

- [x] Add unit coverage for marker contracts, prompt parsing and preview export.
- [ ] Add integration and UI coverage for release workflow.
- [ ] Add Windows installer branding and smoke test.
- [ ] Verify local data is preserved during updates.

Known production follow-ups after the local workflow pass:

- [x] Replace the CSS puppet preview with segmented drawing layers for higher-quality character deformation.
- [x] Replace generic placeholder preview/export characters with the real cleaned drawing.
- [x] Add bundled local FFmpeg MP4 export path.
- [ ] Add imported background/prop files with generated thumbnails.
- [ ] Add Playwright UI coverage for character import, marker editing, story creation, preview and export.
