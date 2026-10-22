# SSHK — Simple Editor Delivery Plan

Goal: CapCut-class video editing plus Canva-class design tools, without cluttering the interface.

## UX rules
- Keep primary navigation to Media, Edit, AI, Text, Design, Audio, Export.
- Show advanced controls only when a relevant clip/object is selected.
- One obvious primary action per panel; show progress, errors, and retry.
- Never label a feature complete until tested in production.

## Phase 1 — Reliability (blocking)
- [ ] Real Replicate POST returns a successful prediction ID.
- [ ] AI result persisted to private Vercel Blob; unauthorized reads denied.
- [ ] Neon job transitions processing → completed, with protected output retrieval.
- [ ] Editor loads protected image result into timeline.
- [ ] FFmpeg exports a playable H.264/AAC MP4, verify codecs, dimensions and duration.
- [ ] Error paths tested (bad token, model failure, timeout, oversized input).

## Phase 2 — Core editing
- [ ] Multi-track drag/reorder and precise trim/split/crop.
- [ ] Transitions and keyframe interpolation tested in preview and export.
- [ ] Undo/redo, autosave and reload with media persistence.
- [ ] Responsive mobile-friendly layout and accessible controls.

## Phase 3 — AI and audio
- [ ] Background removal with before/after preview.
- [ ] Photo enhance/restore and safe retry.
- [ ] Auto captions with editable timings and export burn-in.
- [ ] Text-to-speech, beat sync and auto cut tested against real media.

## Phase 4 — Canva-style design
- [ ] Template browser with editable assets.
- [ ] Shapes, typography, layers, snapping and alignment.
- [ ] Brand colors, logos and reusable assets.
- [ ] Image and video export presets.

## Phase 5 — Distribution
- [ ] Windows desktop installer, signed/release-tested.
- [ ] Android/iOS mobile builds or explicitly scoped PWA alternative.
- [ ] Performance, accessibility, security, and release regression suite.

Each checkbox requires a test artifact (job ID, screenshot, output file, CI log or reproducible steps). Do not count code presence as E2E success.
