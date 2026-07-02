# Inline RPE Editing In Week Adaptation

## Goal

Allow the coach to set or change an exercise `RPE` directly from the week adaptation board without opening the full exercise modal.

## Design

- Keep the current exercise card layout and reuse the existing `RPE` badge area.
- Make the badge clickable.
- On click, open a compact quick-selector with values `0` to `10` plus one clear action.
- Selecting a value updates only the targeted exercise `rpe_target`.
- Clearing removes the `rpe_target` and restores the `RPE —` visual state.
- The existing auto-save in `AdapterSemaine` remains the persistence mechanism, so no new server API is needed.
- The existing `Réinitialiser les RPE` action remains unchanged and continues to clear all exercise `rpe_target` values for the week.

## Scope

- In scope: coach week adaptation board only.
- In scope: numeric quick entry.
- Out of scope: per-member session logger, session detail pages, custom decimal popovers, or changing the server contract.

## UX Notes

- The quick selector should not open the exercise edit modal.
- Clicking elsewhere should close the selector.
- The visual should stay compact so the board remains scannable on laptop width.
