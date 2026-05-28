---
id: FEAT-004
status: in-progress
priority: P3
category: types
target_release: null
created: 2026-05-28
updated: 2026-05-28
depends_on: []
slices: [SLICE-08]
derived_from: null
started_at: 2026-05-28
---
# FEAT-004: Enable noImplicitAny and annotate scripts/**/*.mjs

LSP flags implicit-any as errors; tsc silently accepts (noImplicitAny: false). Enabling aligns LSP and tsc. Scope: tsconfig.json flag + JSDoc @param/@returns on functions with implicit any in scripts/**/*.mjs. AC: tsc --noEmit passes with noImplicitAny:true, lint clean, zero LSP implicit-any warnings.