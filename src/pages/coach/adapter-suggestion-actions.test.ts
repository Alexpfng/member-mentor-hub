import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("actions de suggestion RPE", () => {
  it("confirme le choix du coach sans soumettre le formulaire d'édition", () => {
    const source = readFileSync("src/pages/coach/AdapterSemaine.tsx", "utf8");
    const button = source.slice(
      source.indexOf("{suggestion.actions.map"),
      source.indexOf("{suggestion.actions.map") + 1100,
    );

    expect(button).toContain('type="button"');
    expect(button).toContain("onChange(a.apply)");
    expect(button).toContain("toast.success");
  });

  it("rend visible un échec d'auto-enregistrement", () => {
    const source = readFileSync("src/pages/coach/AdapterSemaine.tsx", "utf8");
    expect(source).toContain(
      'toast.error("La modification n’a pas pu être enregistrée. Réessaie.")',
    );
  });
});
