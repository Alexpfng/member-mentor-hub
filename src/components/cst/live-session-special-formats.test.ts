import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("formats spéciaux — coach et live session", () => {
  it("route les circuits et AMRAP vers un écran timer dédié, même avec plusieurs exercices chaînés", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain('blockType === "circuit" || blockType === "amrap"');
    expect(source).not.toContain('blockType === "circuit" && !isSuperset');
  });

  it("permet au coach de choisir Circuit ou AMRAP dans l'adaptation de semaine", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain('"TYPE DE BLOC"');
    expect(source).toContain('"Circuit"');
    expect(source).toContain('"AMRAP"');
    expect(source).toContain('"TOURS"');
    expect(source).toContain('"OBJECTIF"');
  });
});
