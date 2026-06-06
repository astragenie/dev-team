---
slice: SLICE-99
feat: FEAT-DEMO
contracts: tests/fixtures/openapi/valid-feat.openapi.yaml
---

# UX Spec — SLICE-99

## Interaction flows

User opens the page, clicks Save, sees a confirmation.

## Component hierarchy

- Page
  - SaveButton
  - ConfirmationToast

## State transitions

- loading → success → reset

## Copy and labels

- Button: "Save"
- Toast: "Saved!"

## A11y

- Save button has visible focus ring
- Toast is announced via `aria-live="polite"`

## API touchpoints

- "User clicks Save" → operationId `createThing`
