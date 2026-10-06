# Nutrition Detail and Macro Comparison

## Goal

Let members and their coach understand what was eaten, by meal, and spot meaningful daily changes in protein, carbohydrate, and fat intake without inventing coach-set macro targets.

## Experience

- The member Nutrition page gets a clear `Voir le détail` control for the selected date. Expanding it reveals foods grouped by meal, portions, calories, and a macro radar chart.
- The coach nutrition panel gets the same control for the member's current day, using the existing coach-only member nutrition read.
- The radar compares the selected day's grams of protein, carbohydrates, and fat with each nutrient's average across the previous six calendar days that contain a known value for that nutrient. Axis labels show grams; no target or medical interpretation is implied.
- A missing-data note appears when one or more logged foods have no stored macro values. Missing values are excluded from totals rather than shown as zero.
- Empty history and loading states remain understandable; the detail can be collapsed without losing the current page context.

## Data and Access

- Reuse the existing `nutrition_entries` macro snapshots and existing `getMyNutrition` / `getMemberNutrition` authorization paths.
- Extend the existing nutrition read result with per-day macro totals for the selected day and previous six calendar days.
- No schema migration or new permissions are needed.

## Verification

- Unit-test macro aggregation, prior-day averaging, and incomplete macro data.
- Verify member and coach panels both render the shared detail, and the coach path continues to use the member-scoped server function.
- Run the full test suite and production build; deploy through the existing `main` to Vercel flow after checks pass.
